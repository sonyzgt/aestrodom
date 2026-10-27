import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  bytesToHex,
  getAddress,
  isAddress,
  parseEventLogs,
  type Log,
} from "viem";
import { TOKEN_LAUNCHED_EVENT } from "./abi";
import { METADATA_LIMITS, type Address, type Hex, type LaunchConfig, type TokenLaunchedEvent, type TokenParams } from "./types";

/**
 * Pure launch helpers shared by the browser (transaction building) and the server (verification).
 */

export class LaunchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LaunchValidationError";
  }
}

/** Fresh 32-byte CREATE2 salt from the platform CSPRNG. */
export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

const byteLen = (s: string) => new TextEncoder().encode(s).length;

export interface TokenFormInput {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  creatorFeeRecipient: string;
  creatorTaxBps: number;
  buybackEnabled: boolean;
}

/**
 * Validates user input against protocol rules (creator tax cap read from chain, on-chain metadata
 * limits) and returns exact TokenParams. Throws LaunchValidationError with a user-facing message.
 */
export function buildTokenParams(
  input: TokenFormInput,
  opts: { maxCreatorTaxBps: number; minCreatorTaxBps?: number; expectedEconomics: Hex; salt: Hex },
): TokenParams {
  const name = input.name.trim();
  const symbol = input.symbol.trim().replace(/^\$/, "").toUpperCase();
  if (!name) throw new LaunchValidationError("Token name is required.");
  if (!symbol) throw new LaunchValidationError("Token symbol is required.");
  if (!/^[A-Z0-9]+$/.test(symbol)) throw new LaunchValidationError("Symbol may only contain letters and numbers.");
  if (byteLen(name) > METADATA_LIMITS.name) throw new LaunchValidationError(`Name must be at most ${METADATA_LIMITS.name} bytes.`);
  if (byteLen(symbol) > METADATA_LIMITS.symbol) throw new LaunchValidationError(`Symbol must be at most ${METADATA_LIMITS.symbol} characters.`);
  if (byteLen(input.logo) > METADATA_LIMITS.logo) throw new LaunchValidationError("Logo URL is too long.");
  if (input.logo && !/^(https:\/\/|ipfs:\/\/)/.test(input.logo.trim())) throw new LaunchValidationError("Logo must be an https:// or ipfs:// URL.");
  if (byteLen(input.description) > METADATA_LIMITS.description) throw new LaunchValidationError("Description is too long.");
  for (const [label, v] of [
    ["Website", input.website],
    ["X / Twitter", input.twitter],
    ["Telegram", input.telegram],
    ["Discord", input.discord],
  ] as const) {
    if (byteLen(v) > METADATA_LIMITS.social) throw new LaunchValidationError(`${label} is too long.`);
  }
  if (!isAddress(input.creatorFeeRecipient)) throw new LaunchValidationError("Creator fee recipient must be a valid address.");
  if (/^0x0{40}$/i.test(input.creatorFeeRecipient)) throw new LaunchValidationError("Creator fee recipient cannot be the zero address.");
  const tax = Number(input.creatorTaxBps);
  if (!Number.isInteger(tax) || tax < 0) throw new LaunchValidationError("Creator tax must be a whole number of basis points.");
  if (opts.minCreatorTaxBps !== undefined && tax < opts.minCreatorTaxBps) {
    throw new LaunchValidationError(`Creator tax must be at least ${opts.minCreatorTaxBps / 100}%.`);
  }
  if (tax > opts.maxCreatorTaxBps) {
    throw new LaunchValidationError(`Creator tax cannot exceed the protocol maximum of ${opts.maxCreatorTaxBps / 100}%.`);
  }
  if (tax > 65535) throw new LaunchValidationError("Creator tax is out of range.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(opts.expectedEconomics)) throw new LaunchValidationError("Launch economics are missing. Refresh and try again.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(opts.salt)) throw new LaunchValidationError("Invalid salt.");

  return {
    name,
    symbol,
    logo: input.logo.trim(),
    description: input.description.trim(),
    socials: {
      twitter: input.twitter.trim(),
      telegram: input.telegram.trim(),
      discord: input.discord.trim(),
      website: input.website.trim(),
      farcaster: "",
    },
    creatorFeeRecipient: getAddress(input.creatorFeeRecipient),
    creatorTaxBps: tax,
    buybackEnabled: !!input.buybackEnabled,
    expectedEconomics: opts.expectedEconomics,
    salt: opts.salt,
  };
}

/** Finds the TokenLaunched event emitted by `factory` in a transaction receipt. */
export function parseTokenLaunched(logs: Log[], factory: Address): TokenLaunchedEvent | null {
  const events = parseEventLogs({ abi: [TOKEN_LAUNCHED_EVENT], logs, eventName: "TokenLaunched", strict: true });
  const ev = events.find((e) => e.address.toLowerCase() === factory.toLowerCase());
  if (!ev) return null;
  return {
    token: getAddress(ev.args.token),
    curve: getAddress(ev.args.curve),
    deployer: getAddress(ev.args.deployer),
    pairToken: getAddress(ev.args.pairToken),
    launchConfigId: ev.args.launchConfigId,
    graduationThreshold: ev.args.graduationThreshold,
  };
}

const BPS = 10_000n;

/**
 * Quotes the opening buy on a fresh native-quote curve, mirroring PonsV2BondingCurve.buy():
 * reserves start at (phantomQuote, supply); fee and creator tax come off the input; output is
 * clamped to the sellable amount (supply - reserved). Returns expected and slippage-bounded minimum.
 */
export function quoteInitialBuy(
  config: Pick<LaunchConfig, "supply" | "curveFeeBps" | "phantomQuote" | "graduationThreshold">,
  quoteIn: bigint,
  creatorTaxBps: number,
  slippageBps: number,
): { expectedTokens: bigint; minTokensOut: bigint } {
  if (quoteIn <= 0n) throw new LaunchValidationError("Buy amount must be greater than zero.");
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 5000) {
    throw new LaunchValidationError("Slippage must be between 0.01% and 50%.");
  }
  const fee = (quoteIn * config.curveFeeBps) / BPS;
  const tax = (quoteIn * BigInt(creatorTaxBps)) / BPS;
  const net = quoteIn - fee - tax;
  const reserveIn = config.phantomQuote;
  const reserveOut = config.supply;
  let out = (net * reserveOut) / (reserveIn + net);
  const reserved = (config.supply * config.phantomQuote) / (config.phantomQuote + config.graduationThreshold);
  const sellable = config.supply - reserved;
  if (out > sellable) out = sellable;
  const min = (out * (BPS - BigInt(slippageBps))) / BPS;
  if (min <= 0n) throw new LaunchValidationError("Buy amount is too small.");
  return { expectedTokens: out, minTokensOut: min };
}

export type LaunchErrorKind = "rejected" | "economics_mismatch" | "not_whitelisted" | "revert" | "unknown";

/** Maps wallet / contract errors to user-facing messages. Never exposes stack traces. */
export function describeLaunchError(err: unknown): { kind: LaunchErrorKind; message: string } {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return { kind: "rejected", message: "Transaction rejected." };
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    switch (name) {
      case "LaunchEconomicsMismatch":
        return { kind: "economics_mismatch", message: "Pons launch terms changed since you reviewed them. Review the updated terms and confirm again." };
      case "NotWhitelisted":
        return { kind: "not_whitelisted", message: "Token launching is currently unavailable for this wallet." };
      case "CreatorTaxTooHigh":
        return { kind: "revert", message: "Creator tax exceeds the protocol maximum." };
      case "LaunchFeeNotPaid":
        return { kind: "revert", message: "The launch fee changed. Refresh and try again." };
      case "LaunchConfigDisabled":
      case "InvalidLaunchConfigId":
        return { kind: "revert", message: "This launch configuration is not available." };
      case "MetadataTooLong":
        return { kind: "revert", message: "Token metadata exceeds on-chain limits." };
      case "InvalidTokenParams":
        return { kind: "revert", message: "Token name and symbol are required." };
      case "SlippageExceeded":
        return { kind: "revert", message: "Price moved beyond your slippage tolerance." };
      default:
        if (name) return { kind: "revert", message: `The launch transaction would fail (${name}).` };
    }
    if (/insufficient funds/i.test(err.message)) return { kind: "revert", message: "Insufficient ETH balance for the launch fee and gas." };
    return { kind: "unknown", message: err.shortMessage || "Transaction failed." };
  }
  return { kind: "unknown", message: "Transaction failed." };
}
