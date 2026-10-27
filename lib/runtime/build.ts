import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { addLog } from "@/lib/projects/logs";
import { ensureWorkingCopy } from "@/lib/projects/filesystem";
import { log, errorMessage } from "@/lib/logger";
import { ensureContainer, exec, syncFiles, RuntimeUnavailableError, type ContainerKind } from "./docker";

export interface BuildResult {
  ok: boolean;
  /** Compiler / bundler errors, already stripped of absolute container paths. */
  errors: string;
  durationMs: number;
  hostPort: number | null;
  /** True when the failure was the runtime itself (Docker down), not the project code. */
  infrastructure?: boolean;
}

// Serialize builds per project+kind within this process.
const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}

/** Parses the JSON-lines protocol emitted by runtime/build.mjs. */
export function parseBuildOutput(stdout: string): { steps: string[]; errors: string[]; done: boolean } {
  const steps: string[] = [];
  const errors: string[] = [];
  let done = false;
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const msg = JSON.parse(t) as { kind?: string; message?: string };
      if (msg.kind === "step" && msg.message) steps.push(msg.message);
      else if (msg.kind === "error" && msg.message) errors.push(msg.message);
      else if (msg.kind === "done") done = true;
    } catch {
      // Non-protocol output (warnings) is ignored.
    }
  }
  return { steps, errors, done };
}

/**
 * Copies the working copy into the project's sandbox container and runs the production build there.
 * Project code is never executed on the host.
 */
export async function buildProject(projectId: string, slug: string, kind: ContainerKind = "preview"): Promise<BuildResult> {
  return withLock(`${projectId}:${kind}`, async () => {
    const started = Date.now();
    const source = kind === "production" ? "DEPLOY" : "BUILD";
    try {
      await ensureWorkingCopy(projectId);
      await addLog(projectId, source, "INFO", "Preparing sandbox");
      const { container, info } = await ensureContainer(projectId, slug, kind);
      await syncFiles(container, projectId);
      await addLog(projectId, source, "INFO", "Building application");
      const res = await exec(container, ["node", "/opt/prismatic/build.mjs"], env.buildTimeoutSeconds);
      const parsed = parseBuildOutput(res.stdout);
      const ok = res.exitCode === 0 && parsed.done;
      const durationMs = Date.now() - started;
      let errors = parsed.errors.join("\n").trim();
      if (!ok && !errors) {
        errors = res.exitCode === 137 ? "Build timed out or ran out of memory." : (res.stderr || "Build failed").slice(-4000);
      }
      if (ok) {
        await addLog(projectId, source, "SUCCESS", `Build completed in ${(durationMs / 1000).toFixed(1)}s`);
      } else {
        await addLog(projectId, source, "ERROR", `Build failed\n${errors}`);
      }
      await prisma.project.update({ where: { id: projectId }, data: { lastBuildOk: ok } });
      log.info("build.finished", { projectId, kind, ok, durationMs });
      return { ok, errors, durationMs, hostPort: info.hostPort };
    } catch (err) {
      const infra = err instanceof RuntimeUnavailableError;
      const message = infra ? (err as Error).message : "The build sandbox failed unexpectedly.";
      log.error("build.error", { projectId, kind, error: errorMessage(err) });
      await addLog(projectId, source, "ERROR", message);
      return { ok: false, errors: message, durationMs: Date.now() - started, hostPort: null, infrastructure: true };
    }
  });
}
