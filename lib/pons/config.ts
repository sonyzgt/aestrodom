import "server-only";
import { getAddress, isAddress } from "viem";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import type { Address, PonsDeployment } from "./types";

/**
 * Single source of truth for Pons V2 contract addresses. Addresses come from the environment
 * (see .env.example, values from docs.ponsfamily.com/docs/v2) and are never hardcoded elsewhere.
 */
export class PonsNotConfiguredError extends Error {
  constructor(message = "Token launching is not configured on this server.") {
    super(message);
    this.name = "PonsNotConfiguredError";
  }
}

function addr(name: string, required: boolean): Address | null {
  const v = process.env[name]?.trim();
  if (!v) {
    if (required) throw new PonsNotConfiguredError(`${name} is not set.`);
    return null;
  }
  if (!isAddress(v)) throw new PonsNotConfiguredError(`${name} is not a valid address.`);
  return getAddress(v);
}

export function ponsDeployment(): PonsDeployment {
  const chainId = Number(process.env.PONS_V2_CHAIN_ID || ROBINHOOD_CHAIN_ID);
  if (chainId !== ROBINHOOD_CHAIN_ID) throw new PonsNotConfiguredError("PONS_V2_CHAIN_ID must be 4663 (Robinhood Chain).");
  return {
    chainId,
    factory: addr("PONS_V2_FACTORY_ADDRESS", true)!,
    launchAndBuy: addr("PONS_V2_LAUNCH_AND_BUY_ADDRESS", false),
    feeEscrow: addr("PONS_V2_FEE_ESCROW_ADDRESS", false),
  };
}
