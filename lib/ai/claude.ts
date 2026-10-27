import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessage,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { env } from "@/lib/env";

/**
 * Server-only Claude client. ANTHROPIC_API_KEY is read by the SDK from the server environment and
 * is never sent to the browser or into project sandboxes.
 */
const g = globalThis as unknown as { __anthropic?: Anthropic };

export function claude(): Anthropic {
  if (!g.__anthropic) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      throw new ClaudeUnavailableError("ANTHROPIC_API_KEY is not configured on the server.");
    }
    g.__anthropic = new Anthropic({ maxRetries: 2, timeout: 10 * 60 * 1000 });
  }
  return g.__anthropic;
}

export class ClaudeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeUnavailableError";
  }
}

export class ClaudeRefusalError extends Error {
  constructor() {
    super("Claude declined this request.");
    this.name = "ClaudeRefusalError";
  }
}

export interface TurnCallbacks {
  onText?: (delta: string) => void;
  onToolStart?: (id: string, name: string) => void;
}

export interface TurnParams {
  system: BetaTextBlockParam[];
  messages: BetaMessageParam[];
  tools?: BetaToolUnion[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

/**
 * One streamed Claude turn. Streaming avoids HTTP timeouts on long generations; tool inputs stream
 * eagerly and are validated by the caller before anything is applied.
 *
 * Server-side refusal fallbacks are enabled ("default" routing), so a safety-classifier decline on
 * the primary model is retried on a fallback model inside the same call.
 */
export async function streamTurn(params: TurnParams, cb: TurnCallbacks = {}): Promise<BetaMessage> {
  const stream = claude().beta.messages.stream({
    model: env.anthropicModel,
    max_tokens: params.maxTokens ?? env.aiMaxOutputTokens,
    system: params.system,
    messages: params.messages,
    tools: params.tools,
    tool_choice: params.tools?.length ? { type: "auto" } : undefined,
    thinking: { type: "adaptive" },
    output_config: { effort: params.effort ?? env.anthropicEffort },
    // Cache the stable prefix (system + tools) and the growing tool-loop history.
    cache_control: { type: "ephemeral" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  stream.on("text", (delta) => cb.onText?.(delta));
  stream.on("streamEvent", (event) => {
    if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
      cb.onToolStart?.(event.content_block.id, event.content_block.name);
    }
  });

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new ClaudeRefusalError();
  return message;
}

export function textOf(message: BetaMessage): string {
  return message.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export function usageOf(message: BetaMessage) {
  const u = message.usage;
  return {
    inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

export { Anthropic };
