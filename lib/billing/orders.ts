import "server-only";
import { randomInt } from "crypto";
import { erc20Abi, getAddress, isAddress, isHash, parseEventLogs, type Hex } from "viem";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api";
import { log } from "@/lib/logger";
import { publicClient } from "@/lib/pons/server";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { quoteTopup } from "./price";

/** The quoted token amount is held this long; payments mined later are rejected (the price may have moved). */
const ORDER_TTL_MS = 15 * 60 * 1000;
/** A payment mined in time can still be claimed this long after the order was created (closed tab, slow RPC…). */
const CLAIM_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Allowed drift between our clock and block timestamps. */
const CLOCK_SKEW_MS = 2 * 60 * 1000;

export interface BillingConfig {
  enabled: boolean;
  chainId: number;
  token: string;
  treasury: string | null;
  creditsPerUsd: number;
  /** Margin over the Claude cost charged per AI run, in percent. */
  marginPercent: number;
  /** Preset top-up amounts (USD). */
  options: number[];
  minUsd: number;
  maxUsd: number;
}

function treasury(): string | null {
  const t = env.creditsTreasury;
  return t && isAddress(t) ? getAddress(t) : null;
}

export function billingConfig(): BillingConfig {
  const to = treasury();
  return {
    enabled: !!to && isAddress(env.creditsToken) && env.creditsPerUsd > 0,
    chainId: ROBINHOOD_CHAIN_ID,
    token: isAddress(env.creditsToken) ? getAddress(env.creditsToken) : env.creditsToken,
    treasury: to,
    creditsPerUsd: env.creditsPerUsd,
    marginPercent: env.creditMarginPercent,
    options: env.topupOptions.filter((o) => o >= env.topupMinUsd && o <= env.topupMaxUsd),
    minUsd: env.topupMinUsd,
    maxUsd: env.topupMaxUsd,
  };
}

/**
 * Creates a pending top-up for `usd` dollars at the live price. The token amount (wei) is locked for
 * ORDER_TTL_MS and made unique among recent orders, so the payment identifies the order.
 */
export async function createOrder(userId: string, usd: number) {
  const cfg = billingConfig();
  if (!cfg.enabled) throw new ApiError(503, "Buying credits is not available right now.", "billing_disabled");
  const open = await prisma.creditOrder.count({ where: { userId, status: "PENDING", expiresAt: { gt: new Date() } } });
  if (open >= 5) throw new ApiError(429, "You have too many unpaid orders. Finish or wait for one to expire.");

  const quote = await quoteTopup(usd);
  if (quote.credits < 1 || quote.amount <= 0n) throw new ApiError(400, "That amount is too small.");

  const since = new Date(Date.now() - CLAIM_WINDOW_MS);
  for (let attempt = 0; attempt < 8; attempt++) {
    // Dust below 1e-12 $AESTRODOM: invisible in price, enough to tell orders apart.
    const amount = (quote.amount + BigInt(randomInt(1, 1_000_000))).toString();
    const clash = await prisma.creditOrder.count({ where: { amount, createdAt: { gte: since } } });
    if (clash) continue;
    return prisma.creditOrder.create({
      data: { userId, credits: quote.credits, usdCents: quote.usdCents, tokenUsd: String(quote.tokenUsd), amount, expiresAt: new Date(Date.now() + ORDER_TTL_MS) },
    });
  }
  throw new ApiError(503, "Could not create an order. Please try again.");
}

/**
 * Credits an order once its payment is on-chain: a successful transaction emitting
 * Transfer(_, treasury, order.amount) from the credit token, mined while the quote was valid.
 * Each transaction can pay for one order only (unique txHash).
 */
export async function confirmOrder(userId: string, orderId: string, txHash: string) {
  if (!isHash(txHash)) throw new ApiError(400, "That doesn't look like a transaction hash.");
  const hash = txHash.toLowerCase() as Hex;
  const order = await prisma.creditOrder.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.status === "PAID") {
    if (order.txHash === hash) return { order, credited: 0 };
    throw new ApiError(409, "This order is already paid.");
  }
  if (Date.now() - order.createdAt.getTime() > CLAIM_WINDOW_MS) throw new ApiError(410, "This order is too old to confirm. Contact support with your transaction hash.");
  const used = await prisma.creditOrder.findUnique({ where: { txHash: hash }, select: { id: true } });
  if (used) throw new ApiError(409, "This transaction was already used for another order.");

  const cfg = billingConfig();
  if (!cfg.treasury) throw new ApiError(503, "Buying credits is not available right now.", "billing_disabled");
  const client = publicClient();
  const receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
  if (!receipt) throw new ApiError(409, "Transaction not found yet. Wait a few seconds and try again.", "tx_pending");
  if (receipt.status !== "success") throw new ApiError(400, "That transaction failed on-chain.");

  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (Number(block.timestamp) * 1000 < order.createdAt.getTime() - CLOCK_SKEW_MS) {
    throw new ApiError(400, "That transaction was sent before this order was created.");
  }
  if (Number(block.timestamp) * 1000 > order.expiresAt.getTime() + CLOCK_SKEW_MS) {
    throw new ApiError(400, "That payment arrived after the quote expired. Contact support with your transaction hash.");
  }

  const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).filter(
    (l) => l.address.toLowerCase() === cfg.token.toLowerCase() && l.args.to.toLowerCase() === cfg.treasury!.toLowerCase(),
  );
  const match = transfers.find((l) => l.args.value === BigInt(order.amount));
  if (!match) {
    throw new ApiError(400, transfers.length ? "The amount sent doesn't match this order." : "No $AESTRODOM payment to the treasury in that transaction.");
  }

  try {
    const credited = await prisma.$transaction(async (tx) => {
      const res = await tx.creditOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "PAID", txHash: hash, payer: getAddress(match.args.from), paidAt: new Date() },
      });
      if (res.count !== 1) throw new ApiError(409, "This order is already paid.");
      const user = await tx.user.update({ where: { id: userId }, data: { credits: { increment: order.credits } }, select: { credits: true } });
      await tx.creditLedger.create({ data: { userId, delta: order.credits, balanceAfter: user.credits, reason: "purchase", refId: order.id } });
      return order.credits;
    });
    log.info("credits.purchased", { userId, orderId: order.id, credits: order.credits, txHash: hash });
    return { order: await prisma.creditOrder.findUniqueOrThrow({ where: { id: order.id } }), credited };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "This transaction was already used for another order.");
    }
    throw err;
  }
}

export function orderJson(o: { id: string; credits: number; usdCents: number; amount: string; status: string; txHash: string | null; expiresAt: Date; paidAt: Date | null; createdAt: Date }) {
  return {
    id: o.id,
    credits: o.credits,
    usd: o.usdCents / 100,
    amount: o.amount,
    status: o.status === "PENDING" && o.expiresAt < new Date() ? "EXPIRED" : o.status,
    txHash: o.txHash,
    expiresAt: o.expiresAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}
