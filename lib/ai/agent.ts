import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessageParam,
  BetaTextBlockParam,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";
import { planLimits } from "@/lib/plans";
import type { SessionUser } from "@/lib/api";
import * as fsx from "@/lib/projects/filesystem";
import { addLog } from "@/lib/projects/logs";
import { refreshPreview } from "@/lib/runtime/preview";
import { getProjectDomain } from "@/lib/deployment/domain";
import { ClaudeRefusalError, ClaudeUnavailableError, streamTurn, textOf, usageOf } from "./claude";
import { AGENT_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from "./prompts";
import { RECENT_MESSAGES, renderContext, selectRelevantFiles } from "./context";
import { TOOL_DEFINITIONS, executeTool, type FileOperation } from "./tools";
import { recordUsage, type AiBilling } from "./usage";
import { chargeRun } from "@/lib/billing/credits";
import { normalizeSkills } from "@/lib/skills";
import { skillPrompts } from "./skill-prompts";

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; status: "running" | "done" | "error"; label?: string }
  | { type: "build"; status: "running" | "ok" | "failed" | "unavailable"; attempt?: number; errors?: string }
  | { type: "preview"; url: string | null }
  | { type: "done"; messageId: string; summary: string; operations: FileOperation[]; buildOk: boolean | null }
  | { type: "error"; message: string };

/** The base prompt plus the project's enabled skills; the cache breakpoint sits on the last block. */
export function systemFor(skills: readonly string[]): BetaTextBlockParam[] {
  const texts = [AGENT_SYSTEM_PROMPT, ...skillPrompts(normalizeSkills(skills))];
  return texts.map((text, i) => (i === texts.length - 1 ? { type: "text", text, cache_control: { type: "ephemeral" } } : { type: "text", text }));
}

// One agent run per project at a time (per app instance).
const running = new Set<string>();
export function isAgentRunning(projectId: string) {
  return running.has(projectId);
}

interface Totals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Folds older messages into the rolling summary. Returns the Claude usage it caused, if any. */
async function maybeSummarize(conversationId: string, userId: string, projectId: string): Promise<Totals | null> {
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!convo) return null;
  const pending = await prisma.message.findMany({
    where: { conversationId, ...(convo.summarizedUntil ? { createdAt: { gt: convo.summarizedUntil } } : {}) },
    orderBy: { createdAt: "asc" },
  });
  // Keep the live window small; fold everything older into the rolling summary.
  if (pending.length <= RECENT_MESSAGES * 2) return null;
  const toFold = pending.slice(0, pending.length - RECENT_MESSAGES);
  const transcript = toFold.map((m) => `${m.role}: ${m.content.slice(0, 2000)}`).join("\n\n");
  const started = Date.now();
  try {
    const msg = await streamTurn(
      {
        system: [{ type: "text", text: SUMMARY_SYSTEM_PROMPT }],
        messages: [
          {
            role: "user",
            content: `<previous_summary>\n${convo.summary}\n</previous_summary>\n<conversation>\n${transcript}\n</conversation>`,
          },
        ],
        maxTokens: 2000,
        effort: "low",
      },
      {},
    );
    const u = usageOf(msg);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { summary: textOf(msg).slice(0, 4000), summarizedUntil: toFold[toFold.length - 1].createdAt },
    });
    await recordUsage({ userId, projectId, kind: "ai.summarize", model: env.anthropicModel, ...u, durationMs: Date.now() - started, success: true });
    return u;
  } catch (err) {
    log.warn("ai.summarize.failed", { projectId, error: errorMessage(err) });
    return null;
  }
}

/** Loads source contents used for relevance scoring (small text files only). */
async function loadForScoring(projectId: string, files: fsx.FileEntry[]) {
  const map = new Map<string, string>();
  for (const f of files) {
    if (f.size > 64 * 1024 || !/\.(tsx?|jsx?|css|html|md|json)$/.test(f.path)) continue;
    map.set(f.path, await fsx.readFile(projectId, f.path).catch(() => ""));
  }
  return map;
}

export interface RunAgentInput {
  user: SessionUser;
  project: Project;
  prompt: string;
  emit: (e: AgentEvent) => void;
  /** "credits" charges the run to the user's prepaid balance once it finishes. */
  billing?: AiBilling;
}

export async function runAgent({ user, project, prompt, emit, billing = "plan" }: RunAgentInput): Promise<void> {
  if (running.has(project.id)) {
    emit({ type: "error", message: "Claude is already working on this project." });
    return;
  }
  running.add(project.id);
  const started = Date.now();
  const totals: Totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  // Claude usage outside the agent turns (the rolling summary); billed with the run.
  let summaryUsage: Totals | null = null;
  const operations: FileOperation[] = [];
  const activity: string[] = [];
  let finalText = "";
  let buildOk: boolean | null = null;
  let success = false;
  const wasDeployed = project.status === "DEPLOYED";
  const isFirstRun = project.status === "CREATING";

  const conversation =
    (await prisma.conversation.findUnique({ where: { projectId: project.id } })) ??
    (await prisma.conversation.create({ data: { projectId: project.id } }));

  try {
    await prisma.message.create({ data: { conversationId: conversation.id, role: "USER", content: prompt } });
    await prisma.project.update({ where: { id: project.id }, data: { status: "BUILDING" } });
    await addLog(project.id, "AI", "INFO", "Claude is working on your request");
    emit({ type: "status", message: "Reading your project" });

    summaryUsage = await maybeSummarize(conversation.id, user.id, project.id);
    await fsx.ensureWorkingCopy(project.id);

    // ---- Context ----
    const convo = await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
    const recent = (
      await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: RECENT_MESSAGES + 1,
      })
    )
      .reverse()
      .slice(0, -1) // exclude the request we just stored
      .map((m) => ({ role: m.role, content: m.content }));
    const files = await fsx.listFiles(project.id);
    const contents = await loadForScoring(project.id, files);
    const relevantPaths = selectRelevantFiles(files, prompt, (p) => contents.get(p), { isNewProject: isFirstRun });
    const relevant = relevantPaths.map((p) => ({ path: p, content: contents.get(p) ?? "" }));
    const contextText = renderContext({
      project: {
        name: project.name,
        slug: project.slug,
        description: project.description,
        framework: project.framework,
        domain: getProjectDomain(project.slug),
        deployed: wasDeployed,
      },
      files,
      relevant,
      summary: convo.summary,
      recent,
      request: prompt,
    });

    const messages: BetaMessageParam[] = [{ role: "user", content: contextText }];
    const system = systemFor(project.skills);
    const limits = planLimits(user.plan);

    let dirtySinceBuild = isFirstRun;
    let repairAttempts = 0;
    let lastBuildErrors = "";
    let buildUnavailable = false;

    const runBuild = async () => {
      const attempt = repairAttempts + 1;
      emit({ type: "build", status: "running", attempt });
      const res = await refreshPreview(project);
      if (res.infrastructure) {
        buildUnavailable = true;
        emit({ type: "build", status: "unavailable", errors: res.errors });
        return { ok: true, errors: "" }; // cannot verify; don't make Claude chase infrastructure errors
      }
      buildOk = res.ok;
      dirtySinceBuild = !res.ok;
      lastBuildErrors = res.errors;
      emit({ type: "build", status: res.ok ? "ok" : "failed", attempt, errors: res.ok ? undefined : res.errors.slice(0, 4000) });
      if (res.ok) emit({ type: "preview", url: res.previewUrl });
      return { ok: res.ok, errors: res.errors };
    };

    let jsonRetries = 0;
    for (let step = 0; step < env.aiMaxAgentSteps; step++) {
      emit({ type: "status", message: step === 0 ? "Claude is thinking" : "Claude is working" });
      let message;
      try {
        message = await streamTurn(
          { system, messages, tools: TOOL_DEFINITIONS },
          {
            onText: (delta) => emit({ type: "text", delta }),
            onToolStart: (id, name) => emit({ type: "tool", id, name, status: "running" }),
          },
        );
        jsonRetries = 0;
      } catch (err) {
        // Eager tool-input streaming can surface unparseable JSON; retry the turn a couple of times.
        if (
          err instanceof Anthropic.APIError ||
          err instanceof ClaudeRefusalError ||
          err instanceof ClaudeUnavailableError ||
          jsonRetries++ >= 2
        )
          throw err;
        log.warn("ai.turn.retry", { projectId: project.id, error: errorMessage(err) });
        continue;
      }
      const u = usageOf(message);
      totals.inputTokens += u.inputTokens;
      totals.outputTokens += u.outputTokens;
      totals.cacheReadTokens += u.cacheReadTokens;
      totals.cacheWriteTokens += u.cacheWriteTokens;
      const text = textOf(message);
      if (text) finalText = text;

      if (message.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: message.content });
        continue;
      }

      const toolUses = message.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
      messages.push({ role: "assistant", content: message.content });

      if (toolUses.length > 0) {
        const results: BetaToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          if (message.stop_reason === "max_tokens") {
            // A tool input cut off at max_tokens may parse as a valid but truncated object: never apply it.
            results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: "Output was truncated before this call finished. Split the change into smaller files or use edit_file." });
            emit({ type: "tool", id: tu.id, name: tu.name, status: "error", label: "Output truncated" });
            continue;
          }
          const outcome = await executeTool(tu.name, tu.input, {
            projectId: project.id,
            maxProjectSizeBytes: limits.maxProjectSizeBytes,
            runBuild,
          });
          if (outcome.operation) {
            operations.push(outcome.operation);
            dirtySinceBuild = true;
          }
          activity.push(outcome.label);
          emit({ type: "tool", id: tu.id, name: tu.name, status: outcome.isError ? "error" : "done", label: outcome.label });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: outcome.content, is_error: outcome.isError || undefined });
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      // Claude finished. Verify the build unless the last thing it did was a passing build.
      if (dirtySinceBuild && !buildUnavailable) {
        const res = await runBuild();
        if (!res.ok) {
          if (repairAttempts < env.aiMaxRepairAttempts) {
            repairAttempts++;
            emit({ type: "status", message: `Your application failed to build. Claude is attempting to fix it (${repairAttempts}/${env.aiMaxRepairAttempts}).` });
            await addLog(project.id, "AI", "WARN", `Automatic repair attempt ${repairAttempts}`);
            messages.push({
              role: "user",
              content: `Automatic check from the platform: the build failed after your changes. Fix the errors with minimal changes, then run_build again.\n<build_errors>\n${res.errors.slice(0, 8000)}\n</build_errors>`,
            });
            continue;
          }
          throw new BuildFailedError(lastBuildErrors);
        }
      }
      success = true;
      break;
    }
    if (!success) throw new Error("Agent step limit reached");

    const summary = finalText || (operations.length ? "Applied your changes." : "No changes were needed.");
    const saved = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: summary,
        metadata: { operations, activity, buildOk, repairAttempts, buildUnavailable } as object,
      },
    });
    await fsx.syncSize(project.id);
    await addLog(project.id, "AI", "SUCCESS", `Claude finished: ${operations.length} file operation(s)`);
    emit({ type: "done", messageId: saved.id, summary, operations, buildOk });
  } catch (err) {
    const userMessage =
      err instanceof BuildFailedError
        ? "Your application failed to build after 3 automatic repair attempts. The preview still shows the last working version — try describing the change differently."
        : err instanceof ClaudeUnavailableError
          ? "Claude is not configured on this server."
          : err instanceof Anthropic.RateLimitError
            ? "Claude is busy right now. Please try again in a moment."
            : "Claude could not complete this change.";
    log.error("ai.run.failed", { userId: user.id, projectId: project.id, error: errorMessage(err) });
    await addLog(project.id, "AI", "ERROR", userMessage);
    await prisma.message
      .create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: userMessage,
          metadata: { operations, activity, error: true } as object,
        },
      })
      .catch(() => undefined);
    emit({ type: "error", message: userMessage });
  } finally {
    running.delete(project.id);
    const durationMs = Date.now() - started;
    // Only runs that actually reached Claude count against the user's daily quota.
    if (totals.inputTokens + totals.outputTokens > 0) {
      await recordUsage({
        userId: user.id,
        projectId: project.id,
        kind: "ai.generate",
        model: env.anthropicModel,
        ...totals,
        durationMs,
        success,
      }).catch(() => undefined);
    }
    if (billing === "credits") {
      const s = summaryUsage;
      const billed: Totals = s
        ? {
            inputTokens: totals.inputTokens + s.inputTokens,
            outputTokens: totals.outputTokens + s.outputTokens,
            cacheReadTokens: totals.cacheReadTokens + s.cacheReadTokens,
            cacheWriteTokens: totals.cacheWriteTokens + s.cacheWriteTokens,
          }
        : totals;
      if (billed.inputTokens + billed.outputTokens > 0) await chargeRun(user.id, project.id, billed);
    }
    const live = await prisma.deployment.count({ where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" } });
    const status = live > 0 ? "DEPLOYED" : success || !isFirstRun ? "READY" : "ERROR";
    await prisma.project.update({ where: { id: project.id }, data: { status } }).catch(() => undefined);
    log.info("ai.run.finished", {
      userId: user.id,
      projectId: project.id,
      success,
      durationMs,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      operations: operations.length,
      buildOk,
    });
  }
}

class BuildFailedError extends Error {
  constructor(public errors: string) {
    super("Build failed after repair attempts");
  }
}
