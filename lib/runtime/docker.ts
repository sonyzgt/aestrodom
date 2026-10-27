import "server-only";
import Docker from "dockerode";
import { PassThrough } from "stream";
import tar from "tar-stream";
import { env } from "@/lib/env";
import { readAllFiles } from "@/lib/projects/filesystem";

/**
 * Low-level Docker sandbox for generated projects.
 *
 * Security model (see docs/SECURITY.md):
 *  - every project runs in its own container from the fixed runtime image
 *  - non-root user, all capabilities dropped, no-new-privileges, never privileged
 *  - memory / CPU / PID limits, noexec tmpfs for /tmp
 *  - no bind mounts at all: files are copied in with the Docker archive API, so no host path is exposed
 *  - no environment variables from Prismatic are passed in (no secrets can leak into project code)
 *  - production mode attaches containers only to an internal network (no egress) shared with the proxy
 *  - the Docker socket is only ever used by this server, never mounted into project containers
 */
export class RuntimeUnavailableError extends Error {
  constructor(message = "The preview runtime is not available. Is Docker running?") {
    super(message);
    this.name = "RuntimeUnavailableError";
  }
}

const g = globalThis as unknown as { __docker?: Docker };
export function docker(): Docker {
  // dockerode/docker-modem honour DOCKER_HOST (tcp://, unix://, npipe://) and default to the local socket.
  if (!g.__docker) g.__docker = new Docker();
  return g.__docker;
}

export type ContainerKind = "preview" | "production";
const RUNTIME_PORT = "3000/tcp";
const PROJECT_UID = 1000; // `node` user in node:alpine

export function containerName(projectId: string, kind: ContainerKind) {
  return `prismatic-${kind === "preview" ? "preview" : "prod"}-${projectId}`;
}

/** DNS alias on the project network that the reverse proxy dials. */
export function containerAlias(slug: string, kind: ContainerKind) {
  return kind === "preview" ? `preview-${slug}` : `site-${slug}`;
}

export async function ping(): Promise<boolean> {
  try {
    await docker().ping();
    return true;
  } catch {
    return false;
  }
}

async function ensureImage() {
  try {
    await docker().getImage(env.runtimeImage).inspect();
  } catch {
    throw new RuntimeUnavailableError(
      `Runtime image ${env.runtimeImage} is missing. Build it with "npm run runtime:build".`,
    );
  }
}

async function ensureNetwork() {
  if (env.deploymentMode !== "production") return;
  const nets = await docker().listNetworks({ filters: { name: [env.projectNetwork] } });
  if (!nets.some((n) => n.Name === env.projectNetwork)) {
    // Internal: containers on this network have no route to the internet.
    await docker().createNetwork({ Name: env.projectNetwork, Driver: "bridge", Internal: true, CheckDuplicate: true });
  }
}

export interface ContainerInfo {
  name: string;
  running: boolean;
  hostPort: number | null;
}

async function inspectInfo(c: Docker.Container): Promise<ContainerInfo> {
  const info = await c.inspect();
  const binding = info.NetworkSettings?.Ports?.[RUNTIME_PORT]?.[0];
  return {
    name: info.Name.replace(/^\//, ""),
    running: info.State.Running,
    hostPort: binding?.HostPort ? Number(binding.HostPort) : null,
  };
}

export async function getContainer(projectId: string, kind: ContainerKind): Promise<Docker.Container | null> {
  const c = docker().getContainer(containerName(projectId, kind));
  try {
    await c.inspect();
    return c;
  } catch {
    return null;
  }
}

export async function containerInfo(projectId: string, kind: ContainerKind): Promise<ContainerInfo | null> {
  const c = await getContainer(projectId, kind);
  return c ? inspectInfo(c) : null;
}

/** Creates (or starts) the sandbox container for a project. Idempotent. */
export async function ensureContainer(projectId: string, slug: string, kind: ContainerKind): Promise<{ container: Docker.Container; info: ContainerInfo }> {
  if (!(await ping())) throw new RuntimeUnavailableError();
  let container = await getContainer(projectId, kind);
  if (container) {
    // Recreate when the slug changed (the proxy alias must match) or the runtime image was
    // rebuilt (so fixes to the build/serve scripts reach existing projects). Files are re-synced
    // on every build, so nothing is lost.
    const info = await container.inspect();
    const currentImage = await docker().getImage(env.runtimeImage).inspect().then((i) => i.Id).catch(() => info.Image);
    if (info.Config.Labels?.["prismatic.slug"] !== slug || info.Image !== currentImage) {
      await container.remove({ force: true }).catch(() => undefined);
      container = null;
    }
  }
  if (!container) {
    await ensureImage();
    await ensureNetwork();
    const local = env.deploymentMode === "local";
    container = await docker().createContainer({
      name: containerName(projectId, kind),
      Image: env.runtimeImage,
      User: `${PROJECT_UID}:${PROJECT_UID}`,
      WorkingDir: "/workspace",
      Env: [], // never forward Prismatic env/secrets
      Labels: {
        "prismatic.project": projectId,
        "prismatic.kind": kind,
        "prismatic.slug": slug,
      },
      ExposedPorts: { [RUNTIME_PORT]: {} },
      HostConfig: {
        Privileged: false,
        CapDrop: ["ALL"],
        SecurityOpt: ["no-new-privileges:true"],
        Memory: env.containerMemoryMb * 1024 * 1024,
        MemorySwap: env.containerMemoryMb * 1024 * 1024,
        NanoCpus: Math.round(env.containerCpus * 1e9),
        PidsLimit: env.containerPidsLimit,
        Tmpfs: { "/tmp": "rw,noexec,nosuid,nodev,size=256m" },
        Binds: [],
        Mounts: [],
        IpcMode: "private",
        RestartPolicy: kind === "production" ? { Name: "unless-stopped" } : { Name: "no" },
        LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } },
        ...(local
          ? { NetworkMode: "bridge", PortBindings: { [RUNTIME_PORT]: [{ HostIp: "127.0.0.1", HostPort: "" }] } }
          : { NetworkMode: env.projectNetwork }),
      },
      ...(local
        ? {}
        : {
            NetworkingConfig: {
              EndpointsConfig: { [env.projectNetwork]: { Aliases: [containerAlias(slug, kind)] } },
            },
          }),
    });
  }
  const before = await container.inspect();
  if (!before.State.Running) await container.start();
  return { container, info: await inspectInfo(container) };
}

/** Builds a tar archive of the project's working copy, owned by the unprivileged runtime user. */
async function projectArchive(projectId: string): Promise<Buffer> {
  const files = await readAllFiles(projectId);
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  const sink = new PassThrough();
  sink.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    sink.on("end", () => resolve());
    sink.on("error", reject);
  });
  pack.pipe(sink);
  for (const f of files) {
    pack.entry({ name: f.path, mode: 0o644, uid: PROJECT_UID, gid: PROJECT_UID, mtime: new Date() }, f.content);
  }
  pack.finalize();
  await done;
  return Buffer.concat(chunks);
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function exec(container: Docker.Container, cmd: string[], timeoutSec = 60): Promise<ExecResult> {
  const e = await container.exec({
    Cmd: ["timeout", "-s", "KILL", String(timeoutSec), ...cmd],
    AttachStdout: true,
    AttachStderr: true,
    User: `${PROJECT_UID}:${PROJECT_UID}`,
    WorkingDir: "/workspace",
    Env: [],
  });
  const stream = await e.start({ hijack: true, stdin: false });
  const out = new PassThrough();
  const err = new PassThrough();
  let stdout = "";
  let stderr = "";
  out.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
  err.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
  docker().modem.demuxStream(stream, out, err);
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => resolve(), (timeoutSec + 10) * 1000);
    stream.on("end", () => {
      clearTimeout(t);
      resolve();
    });
    stream.on("error", (er) => {
      clearTimeout(t);
      reject(er);
    });
  });
  const res = await e.inspect();
  return { exitCode: res.ExitCode ?? -1, stdout: stdout.slice(-200_000), stderr: stderr.slice(-50_000) };
}

/** Replaces /workspace in the container with the current working copy (keeps the toolchain symlink). */
export async function syncFiles(container: Docker.Container, projectId: string) {
  await exec(container, ["find", "/workspace", "-mindepth", "1", "-maxdepth", "1", "!", "-name", "node_modules", "-exec", "rm", "-rf", "{}", "+"], 30);
  const archive = await projectArchive(projectId);
  await container.putArchive(archive, { path: "/workspace" });
}

export async function stopContainer(projectId: string, kind: ContainerKind) {
  const c = await getContainer(projectId, kind);
  if (!c) return;
  const info = await c.inspect();
  if (info.State.Running) await c.stop({ t: 5 }).catch(() => undefined);
}

export async function removeContainer(projectId: string, kind: ContainerKind) {
  const c = await getContainer(projectId, kind);
  if (c) await c.remove({ force: true }).catch(() => undefined);
}

export async function restartContainer(projectId: string, kind: ContainerKind) {
  const c = await getContainer(projectId, kind);
  if (!c) return false;
  await c.restart({ t: 5 });
  return true;
}

export async function containerLogs(projectId: string, kind: ContainerKind, tail = 200): Promise<string> {
  const c = await getContainer(projectId, kind);
  if (!c) return "";
  const buf = (await c.logs({ stdout: true, stderr: true, tail, timestamps: false })) as unknown as Buffer;
  // Strip the 8-byte multiplexing headers.
  const out: string[] = [];
  let i = 0;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i + 4);
    out.push(buf.subarray(i + 8, i + 8 + len).toString("utf8"));
    i += 8 + len;
  }
  return out.join("");
}
