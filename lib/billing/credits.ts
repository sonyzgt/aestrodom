import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";

export interface TokenUsage {
  /** All input tokens, including cache reads and cache writes (see lib/ai/claude.ts). */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** What Claude bills for this usage, in USD, at the configured list prices. */
export function claudeCostUsd(u: TokenUsage) {
  const price = env.claudePrice;
  const plain = Math.max(0, u.inputTokens - u.cacheReadTokens - u.cacheWriteTokens);
  return (plain * price.input + u.cacheWriteTokens * price.cacheWrite + u.cacheReadTokens * price.cacheRead + u.outputTokens * price.output) / 1_000_000;
}

/**
 * Credits for one AI run: the Claude cost plus the margin, at CREDITS_PER_USD (100 → 1 credit = $0.01),
 * rounded up to whole credits. Every run that reached Claude costs at least 1.
 */
export function creditsForUsage(u: TokenUsage) {
  const usd = claudeCostUsd(u) * (1 + env.creditMarginPercent / 100);
  // The tiny epsilon keeps exact cent amounts from rounding up through float error.
  return Math.max(1, Math.ceil(usd * env.creditsPerUsd - 1e-9));
}

/** Adds `delta` (negative to charge) to the balance and writes the ledger row, atomically. */
export async function applyCredits(userId: string, delta: number, reason: string, refId?: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { credits: { increment: delta } }, select: { credits: true } });
    await tx.creditLedger.create({ data: { userId, delta, balanceAfter: user.credits, reason, refId } });
    return user.credits;
  });
}

/** Charges a finished credit-funded run. Never throws: the work is already done and persisted. */
export async function chargeRun(userId: string, projectId: string, usage: TokenUsage) {
  const cost = creditsForUsage(usage);
  try {
    const balance = await applyCredits(userId, -cost, "ai.generate", projectId);
    log.info("credits.charged", { userId, projectId, cost, claudeUsd: Number(claudeCostUsd(usage).toFixed(4)), balance });
    return cost;
  } catch (err) {
    log.error("credits.charge_failed", { userId, projectId, cost, error: errorMessage(err) });
    return 0;
  }
}

export async function creditBalance(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
  return u?.credits ?? 0;
}
