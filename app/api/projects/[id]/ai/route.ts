import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError, enforceRateLimit, parseJson, requireProject, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { assertAiQuota } from "@/lib/ai/usage";
import { isAgentRunning, runAgent, type AgentEvent } from "@/lib/ai/agent";
import { SKILL_IDS, normalizeSkills } from "@/lib/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

// `skills`, when given, replaces the project's enabled skills before this run (and is kept for later runs).
const skills = z.array(z.enum(SKILL_IDS)).max(SKILL_IDS.length).optional();
const schema = z.union([
  z.object({ prompt: z.string().trim().min(1).max(20_000), skills }),
  z.object({ initial: z.literal(true), skills }),
]);

/**
 * Starts a Claude agent run for the project and streams progress as NDJSON (one AgentEvent per line).
 * The run continues to completion even if the browser disconnects; results are persisted.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  let project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`ai:${user.id}`, LIMITS.ai);
  const body = await parseJson(req, schema);

  let prompt: string;
  if ("initial" in body) {
    // Allowed once for a new project, and again if that first generation failed before producing a build.
    const hasMessages = await prisma.message.count({ where: { conversation: { projectId: project.id } } });
    const firstRunFailed = project.status === "ERROR" && project.lastBuildOk === null;
    if (!project.initialPrompt || !((project.status === "CREATING" && hasMessages === 0) || firstRunFailed)) {
      throw new ApiError(409, "This project has already been generated.");
    }
    prompt = project.initialPrompt;
  } else {
    prompt = body.prompt;
  }
  if (prompt.length > env.maxPromptChars) throw new ApiError(413, `Keep requests under ${env.maxPromptChars} characters.`);
  if (isAgentRunning(project.id)) throw new ApiError(409, "Claude is already working on this project.");
  const { billing } = await assertAiQuota(user);
  if (body.skills) {
    const next = normalizeSkills(body.skills);
    if (next.join() !== project.skills.join()) project = await prisma.project.update({ where: { id: project.id }, data: { skills: next } });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (e: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => emit({ type: "status", message: "" }), 15_000);
      runAgent({ user, project, prompt, emit, billing }).finally(() => {
        clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      });
    },
    cancel() {
      closed = true; // client went away; the agent keeps running and persists its result
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
});
