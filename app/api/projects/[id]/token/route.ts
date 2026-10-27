import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProject, requireUser, route } from "@/lib/api";
import { reconcileLaunch, launchToJson } from "@/lib/pons/records";
import { tokenState } from "@/lib/pons/server";
import type { Address } from "@/lib/pons/types";
import { log, errorMessage } from "@/lib/logger";

export const runtime = "nodejs";

/** Token linked to this project, plus live on-chain state (cached ~15s server-side). */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  let launch =
    (await prisma.ponsLaunch.findFirst({ where: { projectId: project.id, status: "LAUNCHED" } })) ??
    (await prisma.ponsLaunch.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "desc" } }));
  if (!launch) return NextResponse.json({ launch: null, state: null });
  if (launch.status === "PENDING") launch = await reconcileLaunch(project, launch);

  let state = null;
  if (launch.status === "LAUNCHED" && launch.tokenAddress && launch.curveAddress) {
    state = await tokenState(launch.tokenAddress as Address, launch.curveAddress as Address).catch((err) => {
      log.warn("pons.state.error", { projectId: project.id, error: errorMessage(err) });
      return null;
    });
  }
  return NextResponse.json({ launch: launchToJson(launch), state });
});
