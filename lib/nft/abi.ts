/** AestrodomPass (contracts/AestrodomPass.sol): only the functions Aestrodom calls. */
export const PASS_ABI = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [], outputs: [{ name: "tokenId", type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "MAX_SUPPLY", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "mintOpen", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "mintStart", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "hasMinted", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "contractURI", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "setMetadataURI", stateMutability: "nonpayable", inputs: [{ name: "uri", type: "string" }], outputs: [] },
  { type: "function", name: "setMintOpen", stateMutability: "nonpayable", inputs: [{ name: "open", type: "bool" }], outputs: [] },
  { type: "error", name: "OwnableUnauthorizedAccount", inputs: [{ name: "account", type: "address" }] },
  { type: "error", name: "MintClosed", inputs: [] },
  { type: "error", name: "MintNotStarted", inputs: [{ name: "opensAt", type: "uint256" }] },
  { type: "error", name: "SoldOut", inputs: [] },
  { type: "error", name: "AlreadyMinted", inputs: [] },
] as const;

export const PASS_MAX_SUPPLY = 500;

/** Pass artwork + metadata pinned on IPFS (scripts/pin-pass-metadata.mjs). Every pass uses this URI. */
export const PASS_METADATA_URI = "ipfs://bafkreie3ha23gue4yq6wev476ydioxequ3ex2t3uvbjjdi5aas64gsdkge";

/** UTC calendar day used for the one-free-launch-per-pass-per-day quota. */
export function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Next quota reset (UTC midnight). */
export function nextReset(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

/**
 * The message a pass holder signs to claim a free launch. It names the project and wallet so a
 * signature cannot be replayed for someone else's project, and carries a timestamp the server
 * accepts for a few minutes only. Signing is free: no transaction, no gas.
 */
export function freeLaunchMessage(projectId: string, wallet: string, issuedAt: string) {
  return [
    "Aestrodom free token launch",
    "",
    "I hold an Aestrodom Pass and want Aestrodom to pay the launch fee for this project.",
    "Creator fees go to this wallet.",
    "",
    `Project: ${projectId}`,
    `Wallet: ${wallet.toLowerCase()}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}
