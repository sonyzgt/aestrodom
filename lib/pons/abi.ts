/**
 * Pons V2 ABIs, transcribed from the official contract sources
 * (github.com/ponsdotdev/pons-labs, contractsV2/src/v2) and docs.ponsfamily.com/docs/v2.
 * Only the functions, events and errors PRISMATIC uses are included.
 */

const SOCIALS = {
  name: "socials",
  type: "tuple",
  components: [
    { name: "twitter", type: "string" },
    { name: "telegram", type: "string" },
    { name: "discord", type: "string" },
    { name: "website", type: "string" },
    { name: "farcaster", type: "string" },
  ],
} as const;

export const TOKEN_PARAMS = {
  name: "params",
  type: "tuple",
  components: [
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "logo", type: "string" },
    { name: "description", type: "string" },
    SOCIALS,
    { name: "creatorFeeRecipient", type: "address" },
    { name: "creatorTaxBps", type: "uint16" },
    { name: "buybackEnabled", type: "bool" },
    { name: "expectedEconomics", type: "bytes32" },
    { name: "salt", type: "bytes32" },
  ],
} as const;

const LAUNCH_CONFIG = {
  name: "",
  type: "tuple",
  components: [
    { name: "supply", type: "uint256" },
    { name: "curveFeeBps", type: "uint256" },
    { name: "phantomQuote", type: "uint256" },
    { name: "graduationThreshold", type: "uint256" },
    { name: "poolFee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "enabled", type: "bool" },
  ],
} as const;

const LAUNCHED_TOKEN = {
  name: "",
  type: "tuple",
  components: [
    { name: "token", type: "address" },
    { name: "curve", type: "address" },
    { name: "deployer", type: "address" },
    { name: "creatorFeeRecipient", type: "address" },
    { name: "pairToken", type: "address" },
    { name: "graduationThreshold", type: "uint256" },
    { name: "poolFee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "creatorTaxBps", type: "uint16" },
    { name: "buybackEnabled", type: "bool" },
    { name: "phase", type: "uint8" },
    { name: "sweptQuote", type: "uint256" },
    { name: "sweptTokens", type: "uint256" },
    { name: "sweptAt", type: "uint256" },
    { name: "exists", type: "bool" },
  ],
} as const;

export const PONS_ERRORS = [
  { type: "error", name: "InvalidLaunchConfigId", inputs: [] },
  { type: "error", name: "LaunchConfigDisabled", inputs: [] },
  { type: "error", name: "CreatorTaxTooHigh", inputs: [] },
  { type: "error", name: "LaunchFeeNotPaid", inputs: [] },
  { type: "error", name: "NotWhitelisted", inputs: [] },
  { type: "error", name: "InvalidTokenParams", inputs: [] },
  { type: "error", name: "PairTokenNotApproved", inputs: [] },
  { type: "error", name: "ExemptionListTooLong", inputs: [] },
  { type: "error", name: "MetadataTooLong", inputs: [] },
  { type: "error", name: "SlippageExceeded", inputs: [{ name: "tokensOut", type: "uint256" }, { name: "minTokensOut", type: "uint256" }] },
  { type: "error", name: "CurveGraduated", inputs: [] },
  { type: "error", name: "NativeValueMismatch", inputs: [] },
  { type: "error", name: "UnexpectedNativeValue", inputs: [] },
  {
    type: "error",
    name: "LaunchEconomicsMismatch",
    inputs: [
      { name: "expected", type: "bytes32" },
      { name: "actual", type: "bytes32" },
    ],
  },
  {
    type: "error",
    name: "PairTokenDecimalsMismatch",
    inputs: [
      { name: "expected", type: "uint8" },
      { name: "actual", type: "uint8" },
    ],
  },
] as const;

export const TOKEN_LAUNCHED_EVENT = {
  type: "event",
  name: "TokenLaunched",
  anonymous: false,
  inputs: [
    { name: "token", type: "address", indexed: true },
    { name: "curve", type: "address", indexed: true },
    { name: "deployer", type: "address", indexed: true },
    { name: "pairToken", type: "address", indexed: false },
    { name: "launchConfigId", type: "uint256", indexed: false },
    { name: "graduationThreshold", type: "uint256", indexed: false },
  ],
} as const;

export const PONS_FACTORY_ABI = [
  { type: "function", name: "launchFee", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "launchEnabled", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "maxCreatorTaxBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "launchConfigCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "getLaunchConfig",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [LAUNCH_CONFIG],
  },
  {
    type: "function",
    name: "canLaunch",
    stateMutability: "view",
    inputs: [{ name: "launcher", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "previewLaunchEconomics",
    stateMutability: "view",
    inputs: [
      { name: "launchConfigId", type: "uint256" },
      { name: "pairToken", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getLaunchedToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [LAUNCHED_TOKEN],
  },
  {
    type: "function",
    name: "launchToken",
    stateMutability: "payable",
    inputs: [TOKEN_PARAMS, { name: "launchConfigId", type: "uint256" }, { name: "pairToken", type: "address" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
    ],
  },
  TOKEN_LAUNCHED_EVENT,
  ...PONS_ERRORS,
] as const;

/**
 * PonsV2LaunchAndBuy router. Signature from docs.ponsfamily.com/docs/v2; the router source is not in
 * the public repository, so every call is simulated against the chain before the wallet is asked to sign.
 */
export const PONS_LAUNCH_AND_BUY_ABI = [
  {
    type: "function",
    name: "launchAndBuy",
    stateMutability: "payable",
    inputs: [
      TOKEN_PARAMS,
      { name: "launchConfigId", type: "uint256" },
      { name: "pairToken", type: "address" },
      { name: "quoteIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "snipeTaxExemptions", type: "address[]" },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
      { name: "tokensOut", type: "uint256" },
    ],
  },
  TOKEN_LAUNCHED_EVENT,
  ...PONS_ERRORS,
] as const;

export const PONS_TOKEN_ABI = [
  {
    type: "function",
    name: "getTokenInfo",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "tokenDeployer", type: "address" },
      { name: "tokenLogo", type: "string" },
      { name: "tokenDescription", type: "string" },
      { ...SOCIALS, name: "tokenSocials" },
    ],
  },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export const PONS_CURVE_ABI = [
  { type: "function", name: "graduated", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "readyToGraduate", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "realQuoteReserve", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "graduationThreshold", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;
