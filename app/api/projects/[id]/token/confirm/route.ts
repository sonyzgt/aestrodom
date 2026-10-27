import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, enforceRateLimit, parseJson, requireProject, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { reconcileLaunch, launchToJson } from "@/lib/pons/records";
import { ponsDeployment } from "@/lib/pons/config";
import { NATIVE_PAIR_TOKEN } from "@/lib/pons/types";
import { getProjectDomain } from "@/lib/deployment/domain";
import { addLog } from "@/lib/projects/logs";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const schema = z.object({
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  // Display hints until the chain confirms; every field is overwritten with verified on-chain values.
  name: z.string().max(64),
  symbol: z.string().max(16),
  launchConfigId: z.number().int().min(0).max(10_000),
  creatorFeeRecipient: addr,
  creatorTaxBps: z.number().int().min(0).max(10_000),
  buybackEnabled: z.boolean(),
});

/**
 * Records a launch the user signed in their wallet, then verifies it from the transaction receipt.
 * The token is only marked LAUNCHED after the server has read the TokenLaunched event itself.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`token:confirm:${user.id}`, LIMITS.tokenPrepare);
  const body = await parseJson(req, schema, 2048);
  const deployment = ponsDeployment();

  const already = await prisma.ponsLaunch.findFirst({ where: { projectId: project.id, status: "LAUNCHED" } });
  if (already) throw new ApiError(409, "This project already has a token.");

  const hash = body.transactionHash.toLowerCase();
  const existing = await prisma.ponsLaunch.findUnique({ where: { transactionHash: hash } });
  if (existing && existing.projectId !== project.id) throw new ApiError(409, "This transaction is already linked to another project.");

  const launch =
    existing ??
    (await prisma.ponsLaunch.create({
      data: {
        projectId: project.id,
        userId: user.id,
        transactionHash: hash,
        chainId: deployment.chainId,
        pairToken: NATIVE_PAIR_TOKEN,
        launchConfigId: body.launchConfigId,
        creatorFeeRecipient: body.creatorFeeRecipient,
        creatorTaxBps: body.creatorTaxBps,
        buybackEnabled: body.buybackEnabled,
        name: body.name,
        symbol: body.symbol,
        domain: getProjectDomain(project.slug),
        status: "PENDING",
      },
    }));
  if (!existing) {
    await addLog(project.id, "TOKEN", "INFO", `Launch transaction submitted: ${hash}`);
    log.info("pons.launch.submitted", { userId: user.id, projectId: project.id, transactionHash: hash });
  }

  const reconciled = await reconcileLaunch(project, launch);
  return NextResponse.json({ launch: launchToJson(reconciled) }, { status: reconciled.status === "PENDING" ? 202 : 200 });
});
