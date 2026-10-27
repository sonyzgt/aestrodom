import { defineChain } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_EXPLORER = "https://robinhoodchain.blockscout.com";
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

/**
 * Robinhood Chain mainnet (Arbitrum Orbit L2, ETH gas).
 * The RPC is configurable: ROBINHOOD_RPC_URL on the server, NEXT_PUBLIC_ROBINHOOD_RPC_URL in the browser.
 * Never put credentialed RPC URLs in NEXT_PUBLIC_ variables.
 */
export function robinhoodRpcUrl(): string {
  if (typeof window === "undefined") return process.env.ROBINHOOD_RPC_URL || PUBLIC_RPC;
  return process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC;
}

export const robinhood = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [robinhoodRpcUrl()] } },
  blockExplorers: { default: { name: "Blockscout", url: ROBINHOOD_EXPLORER } },
});

export const explorerTx = (hash: string) => `${ROBINHOOD_EXPLORER}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${ROBINHOOD_EXPLORER}/address/${addr}`;
export const explorerToken = (addr: string) => `${ROBINHOOD_EXPLORER}/token/${addr}`;
