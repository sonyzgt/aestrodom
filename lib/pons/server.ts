import "server-only";
import { createPublicClient, getAddress, http, isAddress, type PublicClient } from "viem";
import type { Project } from "@prisma/client";
import { robinhood, robinhoodRpcUrl } from "@/lib/chains/robinhood";
import { getProjectUrl } from "@/lib/deployment/domain";
import { ponsDeployment } from "./config";
import {
  configToJson,
  readCanLaunch,
  readCurveProgress,
  readLaunchConfigs,
  readLaunchEnabled,
  readLaunchFee,
  readLaunchedToken,
  readMaxCreatorTaxBps,
  readTokenInfo,
} from "./factory";
import { parseTokenLaunched } from "./launch";
import { BUYBACK_ENABLED, CREATOR_TAX_POLICY, METADATA_LIMITS, NATIVE_PAIR_TOKEN, type Address, type Hex, type PreparedLaunch } from "./types";

const g = globalThis as unknown as { __rhClient?: PublicClient };
export function publicClient(): PublicClient {
  if (!g.__rhClient) {
    g.__rhClient = createPublicClient({ chain: robinhood, transport: http(robinhoodRpcUrl(), { retryCount: 2, timeout: 15_000 }) }) as PublicClient;
  }
  return g.__rhClient;
}

// Small TTL cache so many open builder tabs do not multiply RPC traffic.
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) cache.clear();
  return value;
}

function suggestedSymbol(name: string) {
  return name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) || "TOKEN";
}

/**
 * Configuration for the launch modal: factory/chain/ABI coordinates, current on-chain economics and
 * prefilled metadata. Contains no secrets and never receives keys; the wallet signs in the browser.
 * The wallet address is only used for a read-only eligibility hint; the chain enforces it again.
 */
export async function prepareLaunch(project: Project, wallet?: string): Promise<PreparedLaunch> {
  const deployment = ponsDeployment();
  const client = publicClient();
  const base = await cached(`pons:base:${deployment.factory}`, 15_000, async () => {
    const [launchFee, maxCreatorTaxBps, configs, launchEnabled] = await Promise.all([
      readLaunchFee(client, deployment.factory),
      readMaxCreatorTaxBps(client, deployment.factory),
      readLaunchConfigs(client, deployment.factory),
      readLaunchEnabled(client, deployment.factory),
    ]);
    return { launchFee, maxCreatorTaxBps, configs, launchEnabled };
  });
  const canLaunch =
    wallet && isAddress(wallet) ? await readCanLaunch(client, deployment.factory, getAddress(wallet)).catch(() => null) : null;
  const firstEnabled = base.configs.find((c) => c.enabled);
  const website = getProjectUrl(project.slug);
  return {
    deployment,
    launchFee: base.launchFee.toString(),
    launchEnabled: base.launchEnabled,
    maxCreatorTaxBps: base.maxCreatorTaxBps,
    configs: base.configs.map(configToJson),
    defaultConfigId: firstEnabled ? firstEnabled.id : null,
    canLaunch,
    metadata: {
      name: project.name.slice(0, METADATA_LIMITS.name),
      symbol: suggestedSymbol(project.name),
      description: project.description.slice(0, METADATA_LIMITS.description),
      website,
      logo: project.logoUrl ?? "",
    },
    limits: METADATA_LIMITS,
  };
}

export class LaunchVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LaunchVerificationError";
  }
}

/**
 * Verifies a launch transaction from the chain itself (the client only supplies the hash):
 *  - the receipt succeeded and was sent to the Pons V2 factory or LaunchAndBuy router
 *  - a TokenLaunched event was emitted by the factory
 *  - the token's on-chain website matches this project's domain (binds the token to the project,
 *    so one user cannot attach someone else's launch to their project)
 * Returns `null` while the transaction is still pending.
 */
export async function verifyLaunch(project: Project, txHash: Hex) {
  const deployment = ponsDeployment();
  const client = publicClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) return null;
  if (receipt.status !== "success") throw new LaunchVerificationError("The launch transaction reverted.");
  const to = receipt.to ? getAddress(receipt.to) : null;
  const allowedTargets = [deployment.factory, deployment.launchAndBuy].filter(Boolean) as Address[];
  if (!to || !allowedTargets.includes(to)) throw new LaunchVerificationError("Transaction is not a Pons V2 launch.");
  const event = parseTokenLaunched(receipt.logs, deployment.factory);
  if (!event) throw new LaunchVerificationError("No TokenLaunched event found in this transaction.");

  const [launched, info] = await Promise.all([
    readLaunchedToken(client, deployment.factory, event.token),
    readTokenInfo(client, event.token),
  ]);
  if (!launched.exists) throw new LaunchVerificationError("Token is not registered with the Pons V2 factory.");
  const expected = getProjectUrl(project.slug).replace(/\/$/, "").toLowerCase();
  if (info.socials.website.replace(/\/$/, "").toLowerCase() !== expected) {
    throw new LaunchVerificationError("Token website does not match this project.");
  }
  // Aestrodom policy: creator tax 1–4%, buyback off.
  if (launched.creatorTaxBps < CREATOR_TAX_POLICY.minBps || launched.creatorTaxBps > CREATOR_TAX_POLICY.maxBps) {
    throw new LaunchVerificationError("Token creator tax is outside the allowed 1–4% range.");
  }
  if (launched.buybackEnabled !== BUYBACK_ENABLED) throw new LaunchVerificationError("Token buyback setting does not match Aestrodom policy.");
  return {
    event,
    launched,
    info,
    from: getAddress(receipt.from),
    pairToken: event.pairToken === NATIVE_PAIR_TOKEN ? NATIVE_PAIR_TOKEN : event.pairToken,
  };
}

/** Live token state for the dashboard (phase from the factory record, never inferred from price). */
export async function tokenState(tokenAddress: Address, curveAddress: Address) {
  const deployment = ponsDeployment();
  const client = publicClient();
  return cached(`pons:state:${tokenAddress}`, 15_000, async () => {
    const [launched, progress] = await Promise.all([
      readLaunchedToken(client, deployment.factory, tokenAddress),
      readCurveProgress(client, curveAddress).catch(() => null),
    ]);
    return {
      phase: launched.phase,
      phaseLabel: launched.phaseLabel,
      creatorTaxBps: launched.creatorTaxBps,
      buybackEnabled: launched.buybackEnabled,
      creatorFeeRecipient: launched.creatorFeeRecipient,
      raised: progress?.raised.toString() ?? null,
      threshold: progress?.threshold.toString() ?? launched.graduationThreshold.toString(),
      graduated: progress?.graduated ?? launched.phase >= 2,
      checkedAt: new Date().toISOString(),
    };
  });
}
