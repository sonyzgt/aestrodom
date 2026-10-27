import "server-only";
import { prisma } from "@/lib/db";
import { log, errorMessage } from "@/lib/logger";
import { ponsDeployment } from "@/lib/pons/config";
import { publicClient } from "@/lib/pons/server";
import { readLaunchConfigs, readLaunchEconomics, readLaunchFee, readMaxCreatorTaxBps } from "@/lib/pons/factory";

/** Real platform counters for the landing page. Never fabricated; cached briefly. */
export interface PlatformStats {
  projects: number;
  claudeSessions: number;
  liveDeployments: number;
  tokensLaunched: number;
}

export interface PonsSnapshot {
  asOf: string;
  chainId: number;
  factory: string;
  launchFee: string; // wei
  maxCreatorTaxBps: number;
  configCount: number;
  config: { id: number; supply: string; curveFeeBps: string; phantomQuote: string; graduationThreshold: string } | null;
  economics: string | null;
}

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

export async function platformStats(): Promise<PlatformStats | null> {
  try {
    return await cached("platform", 60_000, async () => {
      const [projects, claudeSessions, liveDeployments, tokensLaunched] = await Promise.all([
        prisma.project.count(),
        prisma.usage.count({ where: { kind: "ai.generate" } }),
        prisma.deployment.count({ where: { kind: "PRODUCTION", status: "RUNNING" } }),
        prisma.ponsLaunch.count({ where: { status: "LAUNCHED" } }),
      ]);
      return { projects, claudeSessions, liveDeployments, tokensLaunched };
    });
  } catch (err) {
    log.warn("stats.platform.error", { error: errorMessage(err) });
    return null;
  }
}

/** Current Pons V2 launch terms, read from Robinhood Chain (cached 5 minutes). */
export async function ponsSnapshot(): Promise<PonsSnapshot | null> {
  try {
    return await cached("pons", 5 * 60_000, () =>
      withTimeout(
        (async () => {
          const d = ponsDeployment();
          const client = publicClient();
          const [fee, maxTax, configs] = await Promise.all([
            readLaunchFee(client, d.factory),
            readMaxCreatorTaxBps(client, d.factory),
            readLaunchConfigs(client, d.factory),
          ]);
          const c = configs.find((x) => x.enabled) ?? null;
          const economics = c ? await readLaunchEconomics(client, d.factory, c.id).catch(() => null) : null;
          return {
            asOf: new Date().toISOString(),
            chainId: d.chainId,
            factory: d.factory,
            launchFee: fee.toString(),
            maxCreatorTaxBps: maxTax,
            configCount: configs.length,
            config: c
              ? {
                  id: c.id,
                  supply: c.supply.toString(),
                  curveFeeBps: c.curveFeeBps.toString(),
                  phantomQuote: c.phantomQuote.toString(),
                  graduationThreshold: c.graduationThreshold.toString(),
                }
              : null,
            economics,
          };
        })(),
        5000,
      ),
    );
  } catch (err) {
    log.warn("stats.pons.error", { error: errorMessage(err) });
    return null;
  }
}
