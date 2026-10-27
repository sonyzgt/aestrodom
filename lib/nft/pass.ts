import "server-only";
import { getAddress, isAddress } from "viem";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { publicClient } from "@/lib/pons/server";
import type { Address } from "@/lib/pons/types";
import { PASS_ABI, PASS_MAX_SUPPLY, nextReset, utcDay } from "./abi";

export function passAddress(): Address | null {
  const a = env.passContract.trim();
  return a && isAddress(a) ? getAddress(a) : null;
}

/** Pass token ids held by `wallet`, read from the chain (ERC721Enumerable). */
export async function passesOf(wallet: Address): Promise<number[]> {
  const pass = passAddress();
  if (!pass) return [];
  const client = publicClient();
  const n = Number(await client.readContract({ address: pass, abi: PASS_ABI, functionName: "balanceOf", args: [wallet] }));
  const ids = await Promise.all(
    Array.from({ length: Math.min(n, 50) }, (_, i) =>
      client.readContract({ address: pass, abi: PASS_ABI, functionName: "tokenOfOwnerByIndex", args: [wallet, BigInt(i)] }),
    ),
  );
  return ids.map(Number).sort((a, b) => a - b);
}

/** Passes in `held` that have not been used for a free launch today. */
export async function unusedToday(held: number[], day = utcDay()): Promise<number[]> {
  if (!held.length) return [];
  const used = await prisma.sponsoredLaunch.findMany({ where: { day, passTokenId: { in: held } }, select: { passTokenId: true } });
  const taken = new Set(used.map((u) => u.passTokenId));
  return held.filter((id) => !taken.has(id));
}

export async function sponsoredToday(day = utcDay()) {
  return prisma.sponsoredLaunch.count({ where: { day } });
}

/** Public pass state for the mint page and the launch dialog. */
export async function passStatus(wallet?: string | null) {
  const pass = passAddress();
  const sponsorReady = !!pass && !!env.sponsorPrivateKey && env.freeLaunchDailyCap > 0;
  if (!pass) return { configured: false as const, sponsorReady: false, max: PASS_MAX_SUPPLY };
  const client = publicClient();
  const owner = wallet && isAddress(wallet) ? getAddress(wallet) : null;
  const [minted, mintOpen, hasMinted, held, usedToday, owner_, metadataURI, mintStart] = await Promise.all([
    client.readContract({ address: pass, abi: PASS_ABI, functionName: "totalSupply" }),
    client.readContract({ address: pass, abi: PASS_ABI, functionName: "mintOpen" }),
    owner ? client.readContract({ address: pass, abi: PASS_ABI, functionName: "hasMinted", args: [owner] }) : Promise.resolve(false),
    owner ? passesOf(owner) : Promise.resolve([] as number[]),
    sponsoredToday(),
    client.readContract({ address: pass, abi: PASS_ABI, functionName: "owner" }),
    client.readContract({ address: pass, abi: PASS_ABI, functionName: "contractURI" }),
    client.readContract({ address: pass, abi: PASS_ABI, functionName: "mintStart" }),
  ]);
  const free = await unusedToday(held);
  return {
    configured: true as const,
    contract: pass,
    sponsorReady,
    max: PASS_MAX_SUPPLY,
    minted: Number(minted),
    mintOpen,
    hasMinted,
    passes: held,
    freeLaunchesLeft: free.length,
    dailyCapLeft: Math.max(0, env.freeLaunchDailyCap - usedToday),
    resetsAt: nextReset().toISOString(),
    owner: owner_,
    metadataURI,
    mintStart: new Date(Number(mintStart) * 1000).toISOString(),
  };
}
