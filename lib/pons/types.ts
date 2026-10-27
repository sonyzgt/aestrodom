export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export const NATIVE_PAIR_TOKEN: Address = "0x0000000000000000000000000000000000000000";

export interface LaunchConfig {
  id: number;
  supply: bigint;
  curveFeeBps: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  poolFee: number;
  tickSpacing: number;
  enabled: boolean;
}

/** JSON-safe version of LaunchConfig (bigints as decimal strings) for API responses. */
export interface LaunchConfigJson {
  id: number;
  supply: string;
  curveFeeBps: string;
  phantomQuote: string;
  graduationThreshold: string;
  poolFee: number;
  tickSpacing: number;
  enabled: boolean;
}

export interface Socials {
  twitter: string;
  telegram: string;
  discord: string;
  website: string;
  farcaster: string;
}

export interface TokenParams {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: Socials;
  creatorFeeRecipient: Address;
  creatorTaxBps: number;
  buybackEnabled: boolean;
  expectedEconomics: Hex;
  salt: Hex;
}

export interface TokenLaunchedEvent {
  token: Address;
  curve: Address;
  deployer: Address;
  pairToken: Address;
  launchConfigId: bigint;
  graduationThreshold: bigint;
}

/** GraduationPhase enum from ILaunchpadV2.sol */
export const PHASES = ["Bonding Curve", "Swept", "Graduated (Uniswap v4)", "Rescued"] as const;
export type PhaseLabel = (typeof PHASES)[number] | "Unknown";

export function phaseLabel(phase: number): PhaseLabel {
  return PHASES[phase] ?? "Unknown";
}

export interface PonsDeployment {
  chainId: number;
  factory: Address;
  launchAndBuy: Address | null;
  feeEscrow: Address | null;
}

export interface PreparedLaunch {
  deployment: PonsDeployment;
  launchFee: string;
  launchEnabled: boolean;
  maxCreatorTaxBps: number;
  configs: LaunchConfigJson[];
  defaultConfigId: number | null;
  canLaunch: boolean | null;
  metadata: {
    name: string;
    symbol: string;
    description: string;
    website: string;
    logo: string;
  };
  limits: typeof METADATA_LIMITS;
}

/**
 * Aestrodom launch policy (stricter than the protocol): creator tax between 1% and 4%, buyback off.
 * Enforced in the launch form, in buildTokenParams, and when the server links a launch to a project.
 */
export const CREATOR_TAX_POLICY = { minBps: 100, maxBps: 400, stepBps: 10 } as const;
export const BUYBACK_ENABLED = false;

/** On-chain metadata limits enforced by PonsV2LaunchDeployer. */
export const METADATA_LIMITS = {
  name: 64,
  symbol: 16,
  logo: 512,
  description: 2048,
  social: 256,
} as const;
