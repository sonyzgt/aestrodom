import "server-only";
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { planLimits } from "@/lib/plans";
import { creditBalance } from "@/lib/billing/credits";

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function aiUsageToday(userId: string) {
  const since = startOfUtcDay();
  const [requests, tokens] = await Promise.all([
    prisma.usage.count({ where: { userId, kind: "ai.generate", createdAt: { gte: since } } }),
    prisma.usage.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);
  return { requests, tokens: (tokens._sum.inputTokens ?? 0) + (tokens._sum.outputTokens ?? 0) };
}

export type AiBilling = "plan" | "credits";

/**
 * Decides how a run is paid for, or throws when it can't be. API-key requests always spend credits.
 * In the browser the plan's free daily allowance comes first, then credits.
 */
export async function assertAiQuota(user: { id: string; plan: Plan; apiKeyId?: string }): Promise<{ billing: AiBilling }> {
  const credits = await creditBalance(user.id);
  if (user.apiKeyId) {
    if (credits <= 0) throw new ApiError(402, "You're out of credits. Top up at /dashboard/billing to keep using the API.", "no_credits");
    return { billing: "credits" };
  }
  const limits = planLimits(user.plan);
  const usage = await aiUsageToday(user.id);
  const overRequests = usage.requests >= limits.maxAiRequestsPerDay;
  const overTokens = usage.tokens >= limits.maxAiTokensPerDay;
  if (!overRequests && !overTokens) return { billing: "plan" };
  if (credits > 0) return { billing: "credits" };
  if (overRequests) {
    throw new ApiError(429, `You've used all ${limits.maxAiRequestsPerDay} free AI generations for today. Buy credits to keep building, or wait for the reset at 00:00 UTC.`, "ai_quota");
  }
  throw new ApiError(429, "You've reached today's free AI budget. Buy credits to keep building, or wait for the reset at 00:00 UTC.", "ai_tokens");
}

export async function recordUsage(data: {
  userId: string;
  projectId?: string;
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  success: boolean;
}) {
  await prisma.usage.create({ data });
}
