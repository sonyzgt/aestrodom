import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, enforceRateLimit, parseJson, requireProject, requireSessionUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { launchToJson } from "@/lib/pons/records";
import { sponsoredLaunch } from "@/lib/pons/sponsor";
import { PonsNotConfiguredError } from "@/lib/pons/config";
import type { Hex } from "@/lib/pons/types";

export const runtime = "nodejs";
export const maxDuration = 180;

const social = z.string().trim().max(256).default("");
const schema = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  issuedAt: z.string().max(40),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(20_000),
  name: z.string().max(64),
  symbol: z.string().max(16),
  logo: z.string().max(512).default(""),
  description: z.string().max(2048).default(""),
  twitter: social,
  telegram: social,
  discord: social,
  creatorTaxBps: z.number().int().min(0).max(10_000),
  launchConfigId: z.number().int().min(0).max(10_000),
});

/**
 * Free launch for Aestrodom Pass holders: the platform's sponsor wallet pays the launch fee and gas,
 * and the signed-in wallet that holds the pass becomes the creator fee recipient.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireSessionUser();
  const project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`token:free:${user.id}`, LIMITS.freeLaunch);
  const body = await parseJson(req, schema, 32 * 1024);

  const live = await prisma.deployment.count({ where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" } });
  if (project.status !== "DEPLOYED" || live === 0) throw new ApiError(409, "Deploy your project before launching a token.");
  const existing = await prisma.ponsLaunch.findFirst({ where: { projectId: project.id, status: { in: ["LAUNCHED", "PENDING"] } } });
  if (existing) throw new ApiError(409, existing.status === "LAUNCHED" ? "This project already has a token." : "A launch for this project is still confirming.");

  try {
    const launch = await sponsoredLaunch(project, user.id, { ...body, signature: body.signature as Hex });
    return NextResponse.json({ launch: launchToJson(launch) }, { status: launch.status === "PENDING" ? 202 : 200 });
  } catch (err) {
    if (err instanceof PonsNotConfiguredError) throw new ApiError(503, "Token launching is not configured on this server.");
    throw err;
  }
});
