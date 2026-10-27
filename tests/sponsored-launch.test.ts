import { describe, expect, it, vi } from "vitest";
import { verifyMessage } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

vi.mock("@/lib/pons/server", () => ({ publicClient: () => ({ verifyMessage }) }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { CLAIM_TTL_MS, verifyClaim } from "@/lib/pons/sponsor";
import { freeLaunchMessage, nextReset, utcDay } from "@/lib/nft/abi";

const holder = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const PROJECT = "proj_1";

async function claim(signer = holder, project = PROJECT, issuedAt = new Date().toISOString()) {
  const signature = await signer.signMessage({ message: freeLaunchMessage(project, holder.address, issuedAt) });
  return { issuedAt, signature };
}

describe("free launch claim", () => {
  it("accepts a fresh signature from the pass holder", async () => {
    const { issuedAt, signature } = await claim();
    await expect(verifyClaim(PROJECT, holder.address, issuedAt, signature)).resolves.toBeUndefined();
  });

  it("rejects a signature from another wallet", async () => {
    const { issuedAt, signature } = await claim(other);
    await expect(verifyClaim(PROJECT, holder.address, issuedAt, signature)).rejects.toMatchObject({ code: "bad_signature" });
  });

  it("rejects a signature made for a different project", async () => {
    const { issuedAt, signature } = await claim(holder, "proj_2");
    await expect(verifyClaim(PROJECT, holder.address, issuedAt, signature)).rejects.toMatchObject({ code: "bad_signature" });
  });

  it("rejects an expired claim", async () => {
    const old = new Date(Date.now() - CLAIM_TTL_MS - 1000).toISOString();
    const { issuedAt, signature } = await claim(holder, PROJECT, old);
    await expect(verifyClaim(PROJECT, holder.address, issuedAt, signature)).rejects.toMatchObject({ code: "claim_expired" });
  });
});

describe("daily quota window", () => {
  it("uses the UTC calendar day and resets at UTC midnight", () => {
    const d = new Date("2026-10-19T23:59:59Z");
    expect(utcDay(d)).toBe("2026-10-19");
    expect(nextReset(d).toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
});
