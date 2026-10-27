import "server-only";
import { getAddress, parseAbi, type Address } from "viem";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";
import { publicClient } from "@/lib/pons/server";
import { ponsDeployment } from "@/lib/pons/config";
import { readLaunchedToken } from "@/lib/pons/factory";

/**
 * Live USD price of the credit token. While the token is on its Pons V2 bonding curve, the spot price is
 * quoteReserve / tokenReserve (ETH per token; both 18 decimals, phantom quote included). ETH/USD comes from
 * Coinbase and CoinGecko; when both answer they must agree within 3%.
 */

const CURVE_ABI = parseAbi([
  "function quoteReserve() view returns (uint256)",
  "function tokenReserve() view returns (uint256)",
  "function graduated() view returns (bool)",
]);

const PRICE_TTL_MS = 30_000;
const MAX_ETH_SOURCE_SPREAD = 0.03;

export interface TokenPrice {
  /** Curve reserves (wei): price in ETH per token = quote / token. */
  quoteReserve: bigint;
  tokenReserve: bigint;
  /** ETH/USD in micro-dollars. */
  ethUsdMicro: bigint;
  /** USD per whole token, for display. */
  tokenUsd: number;
  at: number;
}

let curveCache: { token: string; curve: Address } | null = null;
let priceCache: TokenPrice | null = null;

async function curveAddress(): Promise<Address> {
  const token = getAddress(env.creditsToken);
  if (curveCache?.token === token) return curveCache.curve;
  const launched = await readLaunchedToken(publicClient(), ponsDeployment().factory, token);
  if (!launched.exists) throw new Error("credit token is not a Pons V2 launch");
  curveCache = { token, curve: launched.curve };
  return launched.curve;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

async function ethUsd(): Promise<number> {
  const [coinbase, gecko] = await Promise.allSettled([
    fetchJson("https://api.coinbase.com/v2/prices/ETH-USD/spot").then((d) => Number(d?.data?.amount)),
    fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd").then((d) => Number(d?.ethereum?.usd)),
  ]);
  const prices = [coinbase, gecko].flatMap((r) => (r.status === "fulfilled" && Number.isFinite(r.value) && r.value > 0 ? [r.value] : []));
  if (!prices.length) throw new Error("no ETH/USD source answered");
  if (prices.length === 2 && Math.abs(prices[0]! - prices[1]!) / Math.min(prices[0]!, prices[1]!) > MAX_ETH_SOURCE_SPREAD) {
    throw new Error(`ETH/USD sources disagree: ${prices.join(" vs ")}`);
  }
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

export async function tokenPrice(): Promise<TokenPrice> {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache;
  try {
    const curve = await curveAddress();
    const client = publicClient();
    const [graduated, quoteReserve, tokenReserve, eth] = await Promise.all([
      client.readContract({ address: curve, abi: CURVE_ABI, functionName: "graduated" }),
      client.readContract({ address: curve, abi: CURVE_ABI, functionName: "quoteReserve" }),
      client.readContract({ address: curve, abi: CURVE_ABI, functionName: "tokenReserve" }),
      ethUsd(),
    ]);
    // After graduation the price lives in a DEX pool, which this reader doesn't follow yet.
    if (graduated) throw new Error("credit token has graduated from its curve");
    if (quoteReserve <= 0n || tokenReserve <= 0n) throw new Error("empty curve reserves");
    const ethUsdMicro = BigInt(Math.round(eth * 1e6));
    const tokenUsd = (Number(quoteReserve) / Number(tokenReserve)) * eth;
    priceCache = { quoteReserve, tokenReserve, ethUsdMicro, tokenUsd, at: Date.now() };
    return priceCache;
  } catch (err) {
    log.warn("billing.price.error", { error: errorMessage(err) });
    throw new ApiError(503, "Live $AESTRODOM price is unavailable right now. Try again in a minute.", "price_unavailable");
  }
}

/** Token amount (wei) worth `usdCents` at `p`: usd × tokenReserve / (ethUsd × quoteReserve). */
export function tokensForUsd(usdCents: number, p: Pick<TokenPrice, "quoteReserve" | "tokenReserve" | "ethUsdMicro">) {
  return (BigInt(usdCents) * p.tokenReserve * 10n ** 22n) / (p.ethUsdMicro * p.quoteReserve);
}

export function creditsForUsd(usdCents: number) {
  return Math.floor((usdCents * env.creditsPerUsd) / 100);
}

/** Validates a top-up amount in dollars and returns it in cents. */
export function topupCents(usd: number) {
  if (!Number.isFinite(usd)) throw new ApiError(400, "Enter an amount in USD.");
  const cents = Math.round(usd * 100);
  if (cents < Math.round(env.topupMinUsd * 100)) throw new ApiError(400, `The minimum top-up is $${env.topupMinUsd}.`);
  if (cents > Math.round(env.topupMaxUsd * 100)) throw new ApiError(400, `The maximum top-up is $${env.topupMaxUsd}.`);
  return cents;
}

export async function quoteTopup(usd: number) {
  const usdCents = topupCents(usd);
  const p = await tokenPrice();
  return { usdCents, credits: creditsForUsd(usdCents), amount: tokensForUsd(usdCents, p), tokenUsd: p.tokenUsd };
}
