import { afterEach, describe, expect, it, vi } from "vitest";
import { parseUnits } from "viem";

const chain = vi.hoisted(() => ({ readContract: vi.fn() }));
vi.mock("@/lib/pons/server", () => ({ publicClient: () => chain }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// 1 token = $0.00002 → $1 = 50,000 tokens.
vi.mock("@/lib/billing/price", async (orig) => {
  const real = await orig<typeof import("@/lib/billing/price")>();
  return { ...real, tokenPrice: vi.fn(async () => ({ quoteReserve: 10n ** 18n, tokenReserve: 10n ** 26n, ethUsdMicro: 2_000_000_000n, tokenUsd: 0.00002, at: 0 })) };
});

import { assertCanVote } from "@/lib/billing/vote-eligibility";

const WALLET = "0x2222222222222222222222222222222222222222";

describe("vote eligibility", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("needs a linked wallet", async () => {
    await expect(assertCanVote(null)).rejects.toMatchObject({ code: "wallet_required" });
  });

  it("needs $1 of $AESTRODOM at the live price", async () => {
    chain.readContract.mockResolvedValue(parseUnits("49999", 18));
    await expect(assertCanVote(WALLET)).rejects.toMatchObject({ code: "hold_required" });
    chain.readContract.mockResolvedValue(parseUnits("50000", 18));
    await expect(assertCanVote(WALLET)).resolves.toBeUndefined();
  });

  it("can be switched off", async () => {
    vi.stubEnv("VOTE_MIN_HOLD_USD", "0");
    await expect(assertCanVote(null)).resolves.toBeUndefined();
    expect(chain.readContract).not.toHaveBeenCalled();
  });
});
