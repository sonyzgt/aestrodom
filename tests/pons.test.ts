import { describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  keccak256,
  toFunctionSelector,
  toHex,
  zeroAddress,
  type Log,
} from "viem";
import { PONS_FACTORY_ABI, PONS_LAUNCH_AND_BUY_ABI, TOKEN_LAUNCHED_EVENT } from "@/lib/pons/abi";
import { LaunchValidationError, buildTokenParams, parseTokenLaunched, quoteInitialBuy, randomSalt } from "@/lib/pons/launch";
import { phaseLabel } from "@/lib/pons/types";

const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as const;
const TOKEN = "0x1111111111111111111111111111111111111111" as const;
const CURVE = "0x2222222222222222222222222222222222222222" as const;
const DEPLOYER = "0x3333333333333333333333333333333333333333" as const;
const ECON = keccak256(toHex("economics"));

const baseInput = {
  name: "Arrow",
  symbol: "arrow",
  logo: "https://arrow.prismatic.com/logo.svg",
  description: "Arrow token",
  website: "https://arrow.prismatic.com",
  twitter: "",
  telegram: "",
  discord: "",
  creatorFeeRecipient: DEPLOYER,
  creatorTaxBps: 0,
  buybackEnabled: true,
};

describe("Pons V2 ABI matches the Solidity signatures", () => {
  // Canonical signatures derived from PonsV2LaunchFactory.sol TokenParams / Socials struct order.
  const TOKEN_PARAMS = "(string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32)";
  it.each([
    ["launchToken", `launchToken(${TOKEN_PARAMS},uint256,address)`],
    ["previewLaunchEconomics", "previewLaunchEconomics(uint256,address)"],
    ["launchFee", "launchFee()"],
    ["maxCreatorTaxBps", "maxCreatorTaxBps()"],
    ["launchConfigCount", "launchConfigCount()"],
    ["getLaunchConfig", "getLaunchConfig(uint256)"],
    ["canLaunch", "canLaunch(address)"],
    ["getLaunchedToken", "getLaunchedToken(address)"],
  ] as const)("%s selector", (name, sig) => {
    const item = PONS_FACTORY_ABI.find((x) => x.type === "function" && x.name === name);
    expect(item).toBeTruthy();
    expect(toFunctionSelector(item as never)).toBe(toFunctionSelector(`function ${sig}`));
  });

  it("launchAndBuy selector", () => {
    const item = PONS_LAUNCH_AND_BUY_ABI.find((x) => x.type === "function" && x.name === "launchAndBuy");
    expect(toFunctionSelector(item as never)).toBe(
      toFunctionSelector(`function launchAndBuy(${TOKEN_PARAMS},uint256,address,uint256,uint256,address,address[])`),
    );
  });

  it("TokenLaunched topic", () => {
    const [topic0] = encodeEventTopics({ abi: [TOKEN_LAUNCHED_EVENT], eventName: "TokenLaunched" });
    expect(topic0).toBe(keccak256(toHex("TokenLaunched(address,address,address,address,uint256,uint256)")));
  });
});

describe("buildTokenParams", () => {
  it("builds exact params with the pinned economics and salt", () => {
    const salt = randomSalt();
    const p = buildTokenParams(baseInput, { maxCreatorTaxBps: 1000, expectedEconomics: ECON, salt });
    expect(p.symbol).toBe("ARROW");
    expect(p.socials.website).toBe("https://arrow.prismatic.com");
    expect(p.expectedEconomics).toBe(ECON);
    expect(p.salt).toBe(salt);
    // Encodes cleanly against the ABI.
    const data = encodeFunctionData({ abi: PONS_FACTORY_ABI, functionName: "launchToken", args: [p, 0n, zeroAddress] });
    expect(data.startsWith("0x")).toBe(true);
  });

  it("rejects creator tax above the on-chain maximum", () => {
    expect(() => buildTokenParams({ ...baseInput, creatorTaxBps: 1001 }, { maxCreatorTaxBps: 1000, expectedEconomics: ECON, salt: randomSalt() })).toThrow(/protocol maximum/);
    expect(() => buildTokenParams({ ...baseInput, creatorTaxBps: -1 }, { maxCreatorTaxBps: 1000, expectedEconomics: ECON, salt: randomSalt() })).toThrow(LaunchValidationError);
    expect(() => buildTokenParams({ ...baseInput, creatorTaxBps: 1.5 }, { maxCreatorTaxBps: 1000, expectedEconomics: ECON, salt: randomSalt() })).toThrow(LaunchValidationError);
  });

  it("enforces on-chain metadata limits", () => {
    const opts = { maxCreatorTaxBps: 1000, expectedEconomics: ECON, salt: randomSalt() };
    expect(() => buildTokenParams({ ...baseInput, name: "x".repeat(65) }, opts)).toThrow(/64/);
    expect(() => buildTokenParams({ ...baseInput, symbol: "X".repeat(17) }, opts)).toThrow(LaunchValidationError);
    expect(() => buildTokenParams({ ...baseInput, description: "x".repeat(2049) }, opts)).toThrow(LaunchValidationError);
    expect(() => buildTokenParams({ ...baseInput, twitter: "x".repeat(257) }, opts)).toThrow(LaunchValidationError);
  });

  it("rejects invalid recipients and missing economics", () => {
    expect(() => buildTokenParams({ ...baseInput, creatorFeeRecipient: "0x123" }, { maxCreatorTaxBps: 1000, expectedEconomics: ECON, salt: randomSalt() })).toThrow(/valid address/);
    expect(() => buildTokenParams({ ...baseInput, creatorFeeRecipient: zeroAddress }, { maxCreatorTaxBps: 1000, expectedEconomics: ECON, salt: randomSalt() })).toThrow(/zero/);
    expect(() => buildTokenParams(baseInput, { maxCreatorTaxBps: 1000, expectedEconomics: "0x" as `0x${string}`, salt: randomSalt() })).toThrow(/economics/);
  });

  it("generates fresh 32-byte salts", () => {
    const a = randomSalt();
    const b = randomSalt();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("parseTokenLaunched", () => {
  function launchLog(address: `0x${string}`): Log {
    const topics = encodeEventTopics({ abi: [TOKEN_LAUNCHED_EVENT], eventName: "TokenLaunched", args: { token: TOKEN, curve: CURVE, deployer: DEPLOYER } });
    const data = encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      [zeroAddress, 2n, 5n * 10n ** 18n],
    );
    return {
      address,
      topics: topics as [`0x${string}`, ...`0x${string}`[]],
      data,
      blockHash: null,
      blockNumber: null,
      logIndex: 0,
      transactionHash: null,
      transactionIndex: 0,
      removed: false,
    } as unknown as Log;
  }

  it("reads token, curve and config from the factory's event", () => {
    const ev = parseTokenLaunched([launchLog(FACTORY)], FACTORY);
    expect(ev).toEqual({
      token: TOKEN,
      curve: CURVE,
      deployer: DEPLOYER,
      pairToken: zeroAddress,
      launchConfigId: 2n,
      graduationThreshold: 5n * 10n ** 18n,
    });
  });

  it("ignores identical events emitted by other contracts", () => {
    expect(parseTokenLaunched([launchLog("0x9999999999999999999999999999999999999999")], FACTORY)).toBeNull();
  });
});

describe("quoteInitialBuy", () => {
  const config = { supply: 1_000_000_000n * 10n ** 18n, curveFeeBps: 100n, phantomQuote: 2n * 10n ** 18n, graduationThreshold: 5n * 10n ** 18n };

  it("mirrors the curve's constant-product formula net of fee and tax", () => {
    const q = quoteInitialBuy(config, 10n ** 17n, 0, 500);
    const net = 10n ** 17n - (10n ** 17n * 100n) / 10_000n;
    const expected = (net * config.supply) / (config.phantomQuote + net);
    expect(q.expectedTokens).toBe(expected);
    expect(q.minTokensOut).toBe((expected * 9500n) / 10_000n);
    expect(q.minTokensOut).toBeGreaterThan(1n);
  });

  it("clamps to sellable supply", () => {
    const q = quoteInitialBuy(config, 10n ** 24n, 0, 100);
    const reserved = (config.supply * config.phantomQuote) / (config.phantomQuote + config.graduationThreshold);
    expect(q.expectedTokens).toBe(config.supply - reserved);
  });

  it("rejects unsafe slippage and zero amounts", () => {
    expect(() => quoteInitialBuy(config, 0n, 0, 100)).toThrow(LaunchValidationError);
    expect(() => quoteInitialBuy(config, 10n ** 17n, 0, 10_000)).toThrow(LaunchValidationError);
  });
});

describe("phases", () => {
  it("labels the GraduationPhase enum", () => {
    expect(phaseLabel(0)).toBe("Bonding Curve");
    expect(phaseLabel(2)).toBe("Graduated (Uniswap v4)");
    expect(phaseLabel(9)).toBe("Unknown");
  });
});

describe("Aestrodom creator tax policy (1–4%)", () => {
  const opts = (salt: `0x${string}`) => ({ maxCreatorTaxBps: 400, minCreatorTaxBps: 100, expectedEconomics: ECON, salt });
  it("accepts 1% to 4%", () => {
    expect(buildTokenParams({ ...baseInput, creatorTaxBps: 100, buybackEnabled: false }, opts(randomSalt())).creatorTaxBps).toBe(100);
    expect(buildTokenParams({ ...baseInput, creatorTaxBps: 250, buybackEnabled: false }, opts(randomSalt())).creatorTaxBps).toBe(250);
    expect(buildTokenParams({ ...baseInput, creatorTaxBps: 400, buybackEnabled: false }, opts(randomSalt())).creatorTaxBps).toBe(400);
  });
  it("rejects below 1% and above 4%", () => {
    expect(() => buildTokenParams({ ...baseInput, creatorTaxBps: 0 }, opts(randomSalt()))).toThrow(/at least 1%/);
    expect(() => buildTokenParams({ ...baseInput, creatorTaxBps: 99 }, opts(randomSalt()))).toThrow(/at least 1%/);
    expect(() => buildTokenParams({ ...baseInput, creatorTaxBps: 401 }, opts(randomSalt()))).toThrow(/maximum/);
  });
});
