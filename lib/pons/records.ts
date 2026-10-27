import "server-only";
import type { PonsLaunch, Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { log, errorMessage } from "@/lib/logger";
import { addLog } from "@/lib/projects/logs";
import { getProjectDomain } from "@/lib/deployment/domain";
import { LaunchVerificationError, verifyLaunch } from "./server";
import type { Hex } from "./types";

/**
 * Re-checks a PENDING launch against the chain and stores the verified on-chain values.
 * Values supplied by the browser are only placeholders until this succeeds.
 */
export async function reconcileLaunch(project: Project, launch: PonsLaunch): Promise<PonsLaunch> {
  if (launch.status !== "PENDING") return launch;
  try {
    const verified = await verifyLaunch(project, launch.transactionHash as Hex);
    if (!verified) return launch; // still pending on chain
    const updated = await prisma.ponsLaunch.update({
      where: { id: launch.id },
      data: {
        status: "LAUNCHED",
        tokenAddress: verified.event.token,
        curveAddress: verified.event.curve,
        deployer: verified.event.deployer,
        pairToken: verified.event.pairToken,
        launchConfigId: Number(verified.event.launchConfigId),
        graduationThreshold: verified.event.graduationThreshold.toString(),
        creatorFeeRecipient: verified.launched.creatorFeeRecipient,
        creatorTaxBps: verified.launched.creatorTaxBps,
        buybackEnabled: verified.launched.buybackEnabled,
        name: verified.info.name,
        symbol: verified.info.symbol,
        logo: verified.info.logo ? verified.info.logo.slice(0, 512) : null,
        domain: getProjectDomain(project.slug),
        error: null,
      },
    });
    await addLog(project.id, "TOKEN", "SUCCESS", `Token $${updated.symbol} launched at ${updated.tokenAddress}`);
    log.info("pons.launch.verified", { projectId: project.id, transactionHash: launch.transactionHash, token: updated.tokenAddress });
    return updated;
  } catch (err) {
    if (err instanceof LaunchVerificationError) {
      const updated = await prisma.ponsLaunch.update({ where: { id: launch.id }, data: { status: "FAILED", error: err.message } });
      await addLog(project.id, "TOKEN", "ERROR", `Launch verification failed: ${err.message}`);
      log.warn("pons.launch.failed", { projectId: project.id, transactionHash: launch.transactionHash, reason: err.message });
      return updated;
    }
    log.warn("pons.launch.reconcile_error", { projectId: project.id, error: errorMessage(err) });
    return launch;
  }
}

export function launchToJson(l: PonsLaunch) {
  return {
    id: l.id,
    status: l.status,
    name: l.name,
    symbol: l.symbol,
    tokenAddress: l.tokenAddress,
    curveAddress: l.curveAddress,
    transactionHash: l.transactionHash,
    chainId: l.chainId,
    pairToken: l.pairToken,
    launchConfigId: l.launchConfigId,
    creatorFeeRecipient: l.creatorFeeRecipient,
    creatorTaxBps: l.creatorTaxBps,
    buybackEnabled: l.buybackEnabled,
    graduationThreshold: l.graduationThreshold,
    domain: l.domain,
    error: l.error,
    createdAt: l.createdAt,
  };
}
