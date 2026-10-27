/**
 * Live, read-only integration test against Robinhood Chain mainnet. Nothing is broadcast:
 * launches are simulated with eth_call and a balance state override.
 * Run with: RUN_LIVE_TESTS=1 npx vitest run tests/live
 */
import { describe, expect, it } from "vitest";
import { createPublicClient, http, parseEther, toFunctionSelector, zeroAddress, type PublicClient } from "viem";
import { robinhood } from "@/lib/chains/robinhood";
import { PONS_FACTORY_ABI, PONS_LAUNCH_AND_BUY_ABI } from "@/lib/pons/abi";
import { readLaunchConfigs, readLaunchEconomics, readLaunchFee, readMaxCreatorTaxBps } from "@/lib/pons/factory";
import { buildTokenParams, describeLaunchError, quoteInitialBuy, randomSalt } from "@/lib/pons/launch";

const FACTORY = (process.env.PONS_V2_FACTORY_ADDRESS || "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e") as `0x${string}`;
const ROUTER = (process.env.PONS_V2_LAUNCH_AND_BUY_ADDRESS || "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948") as `0x${string}`;
const ACCOUNT = "0x1234567890AbcdEF1234567890aBcdef12345678" as const;
const stateOverride = [{ address: ACCOUNT, balance: parseEther("10") }];

describe.skipIf(!process.env.RUN_LIVE_TESTS)("Pons V2 on Robinhood Chain (live, simulated)", () => {
  const client = createPublicClient({ chain: robinhood, transport: http() }) as PublicClient;

  it("deployed bytecode exposes every selector we call", async () => {
    for (const [address, abi] of [
      [FACTORY, PONS_FACTORY_ABI],
      [ROUTER, PONS_LAUNCH_AND_BUY_ABI],
    ] as const) {
      const code = (await client.getCode({ address })) ?? "0x";
      for (const f of abi.filter((x) => x.type === "function")) {
        expect(code.includes(toFunctionSelector(f as never).slice(2)), `${f.name} @ ${address}`).toBe(true);
      }
    }
  }, 60_000);

  it("simulates launchToken and launchAndBuy with pinned economics", async () => {
    const [fee, maxTax, [config], econ] = await Promise.all([
      readLaunchFee(client, FACTORY),
      readMaxCreatorTaxBps(client, FACTORY),
      readLaunchConfigs(client, FACTORY),
      readLaunchEconomics(client, FACTORY, 0),
    ]);
    const params = buildTokenParams(
      { name: "Prismatic Test", symbol: "PTEST", logo: "", description: "simulation", website: "https://test.prismatic.com", twitter: "", telegram: "", discord: "", creatorFeeRecipient: ACCOUNT, creatorTaxBps: 0, buybackEnabled: true },
      { maxCreatorTaxBps: maxTax, expectedEconomics: econ, salt: randomSalt() },
    );
    const launch = await client.simulateContract({ account: ACCOUNT, address: FACTORY, abi: PONS_FACTORY_ABI, functionName: "launchToken", args: [params, 0n, zeroAddress], value: fee, stateOverride });
    expect(launch.result[0]).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const quoteIn = parseEther("0.05");
    const q = quoteInitialBuy(config, quoteIn, 0, 300);
    const lab = await client.simulateContract({
      account: ACCOUNT,
      address: ROUTER,
      abi: PONS_LAUNCH_AND_BUY_ABI,
      functionName: "launchAndBuy",
      args: [{ ...params, salt: randomSalt() }, 0n, zeroAddress, quoteIn, q.minTokensOut, ACCOUNT, []],
      value: fee + quoteIn,
      stateOverride,
    });
    expect(lab.result[2]).toBe(q.expectedTokens);
  }, 90_000);

  it("surfaces LaunchEconomicsMismatch when the pin is stale", async () => {
    const fee = await readLaunchFee(client, FACTORY);
    const params = buildTokenParams(
      { name: "Prismatic Test", symbol: "PTEST", logo: "", description: "", website: "https://test.prismatic.com", twitter: "", telegram: "", discord: "", creatorFeeRecipient: ACCOUNT, creatorTaxBps: 0, buybackEnabled: false },
      { maxCreatorTaxBps: 1000, expectedEconomics: `0x${"11".repeat(32)}`, salt: randomSalt() },
    );
    const err = await client
      .simulateContract({ account: ACCOUNT, address: FACTORY, abi: PONS_FACTORY_ABI, functionName: "launchToken", args: [params, 0n, zeroAddress], value: fee, stateOverride })
      .catch((e) => e);
    expect(describeLaunchError(err).kind).toBe("economics_mismatch");
  }, 60_000);
});
