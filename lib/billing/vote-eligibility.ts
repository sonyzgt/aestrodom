import "server-only";
import { erc20Abi, formatUnits, getAddress, type Address } from "viem";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";
import { publicClient } from "@/lib/pons/server";
import { tokenPrice, tokensForUsd } from "./price";

/**
 * Battleground votes earn rewards, so each voter must hold a little $AESTRODOM in the wallet linked to
 * their account (verified by Privy). That makes farming votes with throwaway accounts cost real money.
 */
export async function assertCanVote(walletAddress: string | null) {
  const minUsd = env.voteMinHoldUsd;
  if (!minUsd) return;
  const need = `at least $${minUsd} of $AESTRODOM`;
  if (!walletAddress) throw new ApiError(403, `Voting needs ${need} in your wallet. Sign in with the wallet that holds it.`, "wallet_required");

  const price = await tokenPrice();
  const min = tokensForUsd(Math.round(minUsd * 100), price);
  const balance = await publicClient().readContract({
    address: getAddress(env.creditsToken) as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [getAddress(walletAddress) as Address],
  });
  if (balance < min) {
    const tokens = Math.ceil(Number(formatUnits(min, 18))).toLocaleString("en-US");
    throw new ApiError(403, `Voting needs ${need} (about ${tokens} tokens) in ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}.`, "hold_required");
  }
}
