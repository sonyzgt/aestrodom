import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, enforceRateLimit, parseJson, requireProject, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { prepareLaunch } from "@/lib/pons/server";
import { PonsNotConfiguredError } from "@/lib/pons/config";
import { log, errorMessage } from "@/lib/logger";

export const runtime = "nodejs";

const schema = z.object({
  // Used only for a read-only canLaunch() hint. Never a key; the contract re-checks msg.sender.
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});

/**
 * Returns Pons V2 launch configuration for the browser wallet to build and sign the transaction.
 * This endpoint never receives, stores or uses private keys and never signs anything.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`token:prepare:${user.id}`, LIMITS.tokenPrepare);
  const body = await parseJson(req, schema, 1024);

  const live = await prisma.deployment.count({ where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" } });
  if (project.status !== "DEPLOYED" || live === 0) throw new ApiError(409, "Deploy your project before launching a token.");
  const existing = await prisma.ponsLaunch.findFirst({ where: { projectId: project.id, status: { in: ["LAUNCHED", "PENDING"] } } });
  if (existing) throw new ApiError(409, existing.status === "LAUNCHED" ? "This project already has a token." : "A launch for this project is still confirming.");

  try {
    const prepared = await prepareLaunch(project, body.wallet);
    log.info("pons.prepare", { userId: user.id, projectId: project.id });
    return NextResponse.json(prepared);
  } catch (err) {
    if (err instanceof PonsNotConfiguredError) throw new ApiError(503, "Token launching is not configured on this server.");
    log.error("pons.prepare.error", { projectId: project.id, error: errorMessage(err) });
    throw new ApiError(502, "Could not read Pons V2 configuration from Robinhood Chain. Try again shortly.");
  }
});
