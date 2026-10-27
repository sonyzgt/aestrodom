import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, erc20Abi, parseUnits, type Hex } from "viem";

const db = vi.hoisted(() => ({
  creditOrder: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  user: { update: vi.fn() },
  creditLedger: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const chain = vi.hoisted(() => ({ getTransactionReceipt: vi.fn(), getBlock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/pons/server", () => ({ publicClient: () => chain }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// Fixed market: 1 token = 1e-8 ETH, ETH = $2,000 → 1 token = $0.00002, so $1 = 50,000 tokens.
const PRICE = { quoteReserve: 10n ** 18n, tokenReserve: 10n ** 26n, ethUsdMicro: 2_000_000_000n, tokenUsd: 0.00002, at: 0 };
vi.mock("@/lib/billing/price", async (orig) => {
  const real = await orig<typeof import("@/lib/billing/price")>();
  return { ...real, tokenPrice: vi.fn(async () => PRICE), quoteTopup: async (usd: number) => { const usdCents = real.topupCents(usd); return { usdCents, credits: real.creditsForUsd(usdCents), amount: real.tokensForUsd(usdCents, PRICE), tokenUsd: PRICE.tokenUsd }; } };
});

import { generateKey, hashKey, looksLikeKey } from "@/lib/billing/keys";
import { claudeCostUsd, creditsForUsage } from "@/lib/billing/credits";
import { billingConfig, confirmOrder, createOrder } from "@/lib/billing/orders";
import { creditsForUsd, tokensForUsd, topupCents } from "@/lib/billing/price";

const TOKEN = "0x72c11afca4c6a30e01fadce6526cc35d857f4f20";
const TREASURY = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const TX = ("0x" + "ab".repeat(32)) as Hex;

function transferLog(to: string, value: bigint, address = TOKEN) {
  return {
    address,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from: PAYER as Hex, to: to as Hex } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
    blockNumber: 1n,
    transactionHash: TX,
    logIndex: 0,
    blockHash: TX,
    transactionIndex: 0,
    removed: false,
  };
}

describe("API keys", () => {
  it("generates well-formed, unique keys and hashes them", () => {
    const a = generateKey();
    const b = generateKey();
    expect(a.key).toMatch(/^aestro_sk_[0-9A-Za-z]{40}$/);
    expect(a.key).not.toBe(b.key);
    expect(looksLikeKey(a.key)).toBe(true);
    expect(a.hash).toBe(hashKey(a.key));
    expect(a.prefix).toBe(a.key.slice(0, 16));
  });

  it("rejects malformed keys", () => {
    expect(looksLikeKey("aestro_sk_short")).toBe(false);
    expect(looksLikeKey("sk-ant-" + "a".repeat(40))).toBe(false);
    expect(looksLikeKey("aestro_sk_" + "a".repeat(39) + "!")).toBe(false);
  });
});

describe("credit pricing", () => {
  const M = 1_000_000;
  const use = (u: Partial<{ inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }>) => ({
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ...u,
  });

  it("follows Claude Opus 5.5 list prices", () => {
    expect(claudeCostUsd(use({ inputTokens: M }))).toBeCloseTo(4);
    expect(claudeCostUsd(use({ outputTokens: M }))).toBeCloseTo(20);
    // inputTokens includes cache reads and writes; each is priced on its own.
    expect(claudeCostUsd(use({ inputTokens: M, cacheReadTokens: M }))).toBeCloseTo(0.2);
    expect(claudeCostUsd(use({ inputTokens: M, cacheWriteTokens: M }))).toBeCloseTo(5);
  });

  it("charges the Claude cost plus 5%, 1 credit = $0.01, rounded up", () => {
    expect(creditsForUsage(use({ inputTokens: M }))).toBe(420);
    expect(creditsForUsage(use({ outputTokens: M }))).toBe(2100);
    expect(creditsForUsage(use({ inputTokens: M, cacheReadTokens: M }))).toBe(21);
    expect(creditsForUsage(use({ inputTokens: M, cacheWriteTokens: M }))).toBe(525);
    // The average production run: $0.4924 at Claude → $0.517 → 52 credits.
    expect(creditsForUsage(use({ inputTokens: 68_804, cacheReadTokens: 42_292, outputTokens: 18_893 }))).toBe(52);
    expect(creditsForUsage(use({ inputTokens: 10, outputTokens: 1 }))).toBe(1);
  });

  it("follows the configured margin", () => {
    vi.stubEnv("CREDIT_MARGIN_PERCENT", "0");
    expect(creditsForUsage(use({ inputTokens: M }))).toBe(400);
    vi.unstubAllEnvs();
  });
});

describe("USD top-up pricing", () => {
  it("converts dollars to tokens at the curve price", () => {
    expect(tokensForUsd(100, PRICE)).toBe(parseUnits("50000", 18));
    expect(tokensForUsd(250, PRICE)).toBe(parseUnits("125000", 18));
  });

  it("gives credits per dollar and enforces limits", () => {
    expect(creditsForUsd(100)).toBe(100);
    expect(creditsForUsd(550)).toBe(550);
    expect(topupCents(1)).toBe(100);
    expect(() => topupCents(0.5)).toThrow("minimum");
    expect(() => topupCents(10_000)).toThrow("maximum");
    expect(() => topupCents(NaN)).toThrow();
  });
});

describe("credit orders", () => {
  const order = { id: "ord1", userId: "u1", credits: 100, usdCents: 100, amount: (parseUnits("50000", 18) + 7n).toString(), status: "PENDING", txHash: null, createdAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 840_000), paidAt: null };

  beforeEach(() => {
    vi.stubEnv("CREDITS_TREASURY_ADDRESS", TREASURY);
    db.creditOrder.findFirst.mockResolvedValue(order);
    db.creditOrder.findUnique.mockResolvedValue(null);
    db.creditOrder.findUniqueOrThrow.mockResolvedValue({ ...order, status: "PAID", txHash: TX });
    db.creditOrder.updateMany.mockResolvedValue({ count: 1 });
    db.user.update.mockResolvedValue({ credits: 100 });
    db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
    chain.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000)) });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("is configured for USD top-ups", () => {
    const cfg = billingConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.treasury).toBe(TREASURY);
    expect(cfg.options).toEqual([1, 5, 10, 25]);
    vi.stubEnv("CREDITS_TREASURY_ADDRESS", "not-an-address");
    expect(billingConfig().enabled).toBe(false);
  });

  it("locks the quoted amount plus a small unique tail", async () => {
    db.creditOrder.count.mockResolvedValue(0);
    db.creditOrder.create.mockImplementation(({ data }: { data: object }) => ({ id: "new", ...data }));
    const o = await createOrder("u1", 1);
    const tail = BigInt(o.amount) - parseUnits("50000", 18);
    expect(tail > 0n && tail < 1_000_000n).toBe(true);
    expect(o).toMatchObject({ credits: 100, usdCents: 100 });
    expect(o.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    await expect(createOrder("u1", 0.1)).rejects.toThrow("minimum");
  });

  it("credits an order paid with the exact amount to the treasury", async () => {
    chain.getTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 1n, logs: [transferLog(TREASURY, BigInt(order.amount))] });
    const res = await confirmOrder("u1", "ord1", TX);
    expect(res.credited).toBe(100);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { credits: { increment: 100 } } }));
    expect(db.creditLedger.create).toHaveBeenCalledWith({ data: expect.objectContaining({ delta: 100, reason: "purchase", refId: "ord1" }) });
  });

  it("rejects a wrong amount, another recipient or another token", async () => {
    for (const log of [transferLog(TREASURY, BigInt(order.amount) - 1n), transferLog(PAYER, BigInt(order.amount)), transferLog(TREASURY, BigInt(order.amount), PAYER)]) {
      chain.getTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 1n, logs: [log] });
      await expect(confirmOrder("u1", "ord1", TX)).rejects.toThrow();
    }
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("rejects failed, reused and pre-order transactions", async () => {
    chain.getTransactionReceipt.mockResolvedValue({ status: "reverted", blockNumber: 1n, logs: [] });
    await expect(confirmOrder("u1", "ord1", TX)).rejects.toThrow("failed");

    db.creditOrder.findUnique.mockResolvedValueOnce({ id: "other" });
    await expect(confirmOrder("u1", "ord1", TX)).rejects.toThrow("already used");

    chain.getTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 1n, logs: [transferLog(TREASURY, BigInt(order.amount))] });
    chain.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor((Date.now() - 3_600_000) / 1000)) });
    await expect(confirmOrder("u1", "ord1", TX)).rejects.toThrow("before this order");

    chain.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor((Date.now() + 3_600_000) / 1000)) });
    await expect(confirmOrder("u1", "ord1", TX)).rejects.toThrow("quote expired");
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("asks to retry while the transaction isn't visible yet", async () => {
    chain.getTransactionReceipt.mockRejectedValue(new Error("not found"));
    await expect(confirmOrder("u1", "ord1", TX)).rejects.toMatchObject({ code: "tx_pending" });
  });
});
