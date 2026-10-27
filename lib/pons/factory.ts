import { getAddress, type PublicClient } from "viem";
import { PONS_CURVE_ABI, PONS_FACTORY_ABI, PONS_TOKEN_ABI } from "./abi";
import { NATIVE_PAIR_TOKEN, phaseLabel, type Address, type Hex, type LaunchConfig, type LaunchConfigJson } from "./types";

/**
 * Read-only access to the Pons V2 factory. Works with any viem PublicClient (server or browser).
 * Every economic value comes from the chain at call time; nothing is hardcoded.
 *
 * Reads are issued as individual eth_calls (no multicall dependency on Robinhood Chain).
 */

export async function readLaunchFee(client: PublicClient, factory: Address): Promise<bigint> {
  return client.readContract({ address: factory, abi: PONS_FACTORY_ABI, functionName: "launchFee" });
}

export async function readMaxCreatorTaxBps(client: PublicClient, factory: Address): Promise<number> {
  return Number(await client.readContract({ address: factory, abi: PONS_FACTORY_ABI, functionName: "maxCreatorTaxBps" }));
}

export async function readCanLaunch(client: PublicClient, factory: Address, wallet: Address): Promise<boolean> {
  return client.readContract({ address: factory, abi: PONS_FACTORY_ABI, functionName: "canLaunch", args: [wallet] });
}

export async function readLaunchEnabled(client: PublicClient, factory: Address): Promise<boolean> {
  return client.readContract({ address: factory, abi: PONS_FACTORY_ABI, functionName: "launchEnabled" });
}

export async function readLaunchConfigs(client: PublicClient, factory: Address, max = 16): Promise<LaunchConfig[]> {
  const count = Number(await client.readContract({ address: factory, abi: PONS_FACTORY_ABI, functionName: "launchConfigCount" }));
  const ids = Array.from({ length: Math.min(count, max) }, (_, i) => i);
  const configs = await Promise.all(
    ids.map((id) => client.readContract({ address: factory, abi: PONS_FACTORY_ABI, functionName: "getLaunchConfig", args: [BigInt(id)] })),
  );
  return configs.map((c, id) => ({
    id,
    supply: c.supply,
    curveFeeBps: c.curveFeeBps,
    phantomQuote: c.phantomQuote,
    graduationThreshold: c.graduationThreshold,
    poolFee: Number(c.poolFee),
    tickSpacing: Number(c.tickSpacing),
    enabled: c.enabled,
  }));
}

export async function readLaunchEconomics(
  client: PublicClient,
  factory: Address,
  launchConfigId: number,
  pairToken: Address = NATIVE_PAIR_TOKEN,
): Promise<Hex> {
  return client.readContract({
    address: factory,
    abi: PONS_FACTORY_ABI,
    functionName: "previewLaunchEconomics",
    args: [BigInt(launchConfigId), pairToken],
  });
}

export async function readLaunchedToken(client: PublicClient, factory: Address, token: Address) {
  const t = await client.readContract({ address: factory, abi: PONS_FACTORY_ABI, functionName: "getLaunchedToken", args: [token] });
  return {
    exists: t.exists,
    token: getAddress(t.token),
    curve: getAddress(t.curve),
    deployer: getAddress(t.deployer),
    creatorFeeRecipient: getAddress(t.creatorFeeRecipient),
    pairToken: getAddress(t.pairToken),
    graduationThreshold: t.graduationThreshold,
    creatorTaxBps: Number(t.creatorTaxBps),
    buybackEnabled: t.buybackEnabled,
    phase: Number(t.phase),
    phaseLabel: phaseLabel(Number(t.phase)),
  };
}

export async function readTokenInfo(client: PublicClient, token: Address) {
  const [deployer, logo, description, socials] = await client.readContract({ address: token, abi: PONS_TOKEN_ABI, functionName: "getTokenInfo" });
  const [name, symbol] = await Promise.all([
    client.readContract({ address: token, abi: PONS_TOKEN_ABI, functionName: "name" }),
    client.readContract({ address: token, abi: PONS_TOKEN_ABI, functionName: "symbol" }),
  ]);
  return { deployer: getAddress(deployer), logo, description, socials, name, symbol };
}

/** Curve progress toward graduation (quote raised vs threshold), read from the curve itself. */
export async function readCurveProgress(client: PublicClient, curve: Address) {
  const [raised, threshold, graduated] = await Promise.all([
    client.readContract({ address: curve, abi: PONS_CURVE_ABI, functionName: "realQuoteReserve" }),
    client.readContract({ address: curve, abi: PONS_CURVE_ABI, functionName: "graduationThreshold" }),
    client.readContract({ address: curve, abi: PONS_CURVE_ABI, functionName: "graduated" }),
  ]);
  return { raised, threshold, graduated };
}

export function configToJson(c: LaunchConfig): LaunchConfigJson {
  return {
    id: c.id,
    supply: c.supply.toString(),
    curveFeeBps: c.curveFeeBps.toString(),
    phantomQuote: c.phantomQuote.toString(),
    graduationThreshold: c.graduationThreshold.toString(),
    poolFee: c.poolFee,
    tickSpacing: c.tickSpacing,
    enabled: c.enabled,
  };
}

export function configFromJson(c: LaunchConfigJson): LaunchConfig {
  return {
    id: c.id,
    supply: BigInt(c.supply),
    curveFeeBps: BigInt(c.curveFeeBps),
    phantomQuote: BigInt(c.phantomQuote),
    graduationThreshold: BigInt(c.graduationThreshold),
    poolFee: c.poolFee,
    tickSpacing: c.tickSpacing,
    enabled: c.enabled,
  };
}
