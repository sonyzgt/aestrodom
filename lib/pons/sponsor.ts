import "server-only";
import { Prisma, type PonsLaunch, type Project } from "@prisma/client";
import { createWalletClient, formatEther, getAddress, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";
import { addLog } from "@/lib/projects/logs";
import { robinhood, robinhoodRpcUrl } from "@/lib/chains/robinhood";
import { getProjectDomain, getProjectUrl } from "@/lib/deployment/domain";
import { freeLaunchMessage, utcDay } from "@/lib/nft/abi";
import { passAddress, passesOf, sponsoredToday, unusedToday } from "@/lib/nft/pass";
import { PONS_FACTORY_ABI } from "./abi";
import { ponsDeployment } from "./config";
import { readLaunchConfigs, readLaunchEconomics, readLaunchFee, readMaxCreatorTaxBps } from "./factory";
import { LaunchValidationError, buildTokenParams, describeLaunchError, randomSalt } from "./launch";
import { reconcileLaunch } from "./records";
import { publicClient } from "./server";
import { BUYBACK_ENABLED, CREATOR_TAX_POLICY, NATIVE_PAIR_TOKEN } from "./types";

/** A signed claim is accepted for this long after it was issued. */
export const CLAIM_TTL_MS = 10 * 60_000;

export interface SponsoredLaunchInput {
  wallet: string;
  issuedAt: string;
  signature: Hex;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  twitter: string;
  telegram: string;
  discord: string;
  creatorTaxBps: number;
  launchConfigId: number;
}

function sponsor() {
  const key = env.sponsorPrivateKey.trim();
  if (!passAddress() || !key || env.freeLaunchDailyCap <= 0) throw new ApiError(503, "Free launches are not available right now.", "sponsor_disabled");
  try {
    return privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
  } catch {
    log.error("sponsor.key.invalid", {});
    throw new ApiError(503, "Free launches are not available right now.", "sponsor_disabled");
  }
}

// One sponsored transaction at a time, so concurrent claims never reuse the sponsor wallet's nonce.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/** Checks the signed claim: fresh, for this project, signed by `wallet` (EOA or smart wallet). */
export async function verifyClaim(projectId: string, wallet: Address, issuedAt: string, signature: Hex, now = Date.now()) {
  const at = Date.parse(issuedAt);
  if (!Number.isFinite(at) || at > now + 60_000 || now - at > CLAIM_TTL_MS) {
    throw new ApiError(400, "This signature has expired. Sign again to claim your free launch.", "claim_expired");
  }
  const ok = await publicClient()
    .verifyMessage({ address: wallet, message: freeLaunchMessage(projectId, wallet, issuedAt), signature })
    .catch(() => false);
  if (!ok) throw new ApiError(401, "The signature does not match this wallet.", "bad_signature");
}

/** Reserves today's quota on one of the holder's passes. The unique (pass, day) key settles races. */
async function reserve(wallet: Address, userId: string, projectId: string) {
  const held = await passesOf(wallet);
  if (!held.length) throw new ApiError(403, "This wallet does not hold an Aestrodom Pass.", "no_pass");
  const day = utcDay();
  if ((await sponsoredToday(day)) >= env.freeLaunchDailyCap) {
    throw new ApiError(429, "Today's free launches are all used. Try again after 00:00 UTC.", "daily_cap");
  }
  for (const passTokenId of await unusedToday(held, day)) {
    try {
      return await prisma.sponsoredLaunch.create({ data: { passTokenId, day, wallet: wallet.toLowerCase(), userId, projectId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new ApiError(429, "Your pass has already been used for a free launch today. It resets at 00:00 UTC.", "pass_used");
}

/**
 * Launches the project's token with the sponsor wallet paying the Pons launch fee and gas.
 * The creator fee recipient is the pass holder's wallet, so every creator fee goes to them.
 * Launch only: no opening buy is ever made with sponsor funds.
 */
export async function sponsoredLaunch(project: Project, userId: string, input: SponsoredLaunchInput): Promise<PonsLaunch> {
  const account = sponsor();
  const wallet = getAddress(input.wallet);
  await verifyClaim(project.id, wallet, input.issuedAt, input.signature);
  const reservation = await reserve(wallet, userId, project.id);

  let hash: Hex;
  let launch: PonsLaunch;
  try {
    ({ hash, launch } = await serialized(async () => {
      const deployment = ponsDeployment();
      const client = publicClient();
      const factory = deployment.factory;
      const [launchFee, maxTax, configs] = await Promise.all([
        readLaunchFee(client, factory),
        readMaxCreatorTaxBps(client, factory),
        readLaunchConfigs(client, factory),
      ]);
      const config = configs.find((c) => c.id === input.launchConfigId);
      if (!config || !config.enabled) throw new LaunchValidationError("This launch configuration is not available. Choose another one.");
      const economics = await readLaunchEconomics(client, factory, config.id, NATIVE_PAIR_TOKEN);
      const params = buildTokenParams(
        {
          name: input.name,
          symbol: input.symbol,
          logo: input.logo,
          description: input.description,
          website: getProjectUrl(project.slug),
          twitter: input.twitter,
          telegram: input.telegram,
          discord: input.discord,
          creatorFeeRecipient: wallet,
          creatorTaxBps: input.creatorTaxBps,
          buybackEnabled: BUYBACK_ENABLED,
        },
        { maxCreatorTaxBps: Math.min(maxTax, CREATOR_TAX_POLICY.maxBps), minCreatorTaxBps: CREATOR_TAX_POLICY.minBps, expectedEconomics: economics, salt: randomSalt() },
      );
      const args = [params, BigInt(config.id), NATIVE_PAIR_TOKEN] as const;
      const { request } = await client.simulateContract({ account, address: factory, abi: PONS_FACTORY_ABI, functionName: "launchToken", args, value: launchFee });
      const gas = await client.estimateContractGas({ account, address: factory, abi: PONS_FACTORY_ABI, functionName: "launchToken", args, value: launchFee });
      const gasPrice = await client.getGasPrice();
      const balance = await client.getBalance({ address: account.address });
      if (balance < launchFee + (gas * gasPrice * 3n) / 2n) {
        log.error("sponsor.balance.low", { sponsor: account.address, balance: formatEther(balance) });
        throw new ApiError(503, "Free launches are paused for a moment. Please try again later.", "sponsor_empty");
      }
      const walletClient = createWalletClient({ account, chain: robinhood, transport: http(robinhoodRpcUrl(), { retryCount: 0, timeout: 30_000 }) });
      const hash = await walletClient.writeContract(request);
      // Record the transaction before anything else can fail, so the reservation is never lost.
      const [launch] = await prisma.$transaction([
        prisma.ponsLaunch.create({
          data: {
            projectId: project.id,
            userId,
            transactionHash: hash.toLowerCase(),
            chainId: deployment.chainId,
            pairToken: NATIVE_PAIR_TOKEN,
            launchConfigId: config.id,
            creatorFeeRecipient: wallet,
            creatorTaxBps: params.creatorTaxBps,
            buybackEnabled: params.buybackEnabled,
            name: params.name,
            symbol: params.symbol,
            domain: getProjectDomain(project.slug),
            status: "PENDING",
          },
        }),
        prisma.sponsoredLaunch.update({ where: { id: reservation.id }, data: { transactionHash: hash.toLowerCase() } }),
      ]);
      // Wait for inclusion here so the next sponsored transaction gets a fresh nonce.
      await client.waitForTransactionReceipt({ hash, timeout: 90_000 }).catch(() => undefined);
      return { hash, launch };
    }));
  } catch (err) {
    // Nothing was sent: give the pass its quota back.
    await prisma.sponsoredLaunch.delete({ where: { id: reservation.id } }).catch(() => undefined);
    if (err instanceof ApiError) throw err;
    if (err instanceof LaunchValidationError) throw new ApiError(400, err.message, "invalid_launch");
    const d = describeLaunchError(err);
    log.warn("sponsor.launch.error", { projectId: project.id, error: errorMessage(err) });
    throw new ApiError(502, d.message, "launch_failed");
  }

  await addLog(project.id, "TOKEN", "INFO", `Free launch (Aestrodom Pass) submitted: ${hash}`);
  log.info("sponsor.launch.submitted", { userId, projectId: project.id, transactionHash: hash, pass: reservation.passTokenId });
  return reconcileLaunch(project, launch);
}
