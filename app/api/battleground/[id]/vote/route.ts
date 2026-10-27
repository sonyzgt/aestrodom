import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, enforceRateLimit, requireSessionUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { assertCanVote } from "@/lib/billing/vote-eligibility";

export const runtime = "nodejs";
type Params = { id: string };

/**
 * Only projects visible on the Battleground (listed and live) with a launched token can be voted on,
 * since top-voted apps are rewarded through their token's creator wallet. Never your own.
 */
async function votable(id: string, userId: string) {
  if (!/^[a-z0-9]{20,40}$/.test(id)) throw new ApiError(404, "Project not found.");
  const project = await prisma.project.findFirst({
    where: { id, listed: true, deployments: { some: { kind: "PRODUCTION", status: "RUNNING" } } },
    select: { id: true, userId: true, ponsLaunches: { where: { status: "LAUNCHED" }, select: { id: true }, take: 1 } },
  });
  if (!project) throw new ApiError(404, "Project not found.");
  if (!project.ponsLaunches.length) throw new ApiError(403, "Only apps with a token can be voted on.", "no_token");
  if (project.userId === userId) throw new ApiError(403, "You can't vote for your own app.", "own_project");
  return project;
}

async function result(projectId: string, voted: boolean) {
  const votes = await prisma.projectVote.count({ where: { projectId } });
  return NextResponse.json({ votes, voted });
}

export const POST = route<Params>(async (_req, { params }) => {
  const user = await requireSessionUser();
  await enforceRateLimit(`vote:${user.id}`, LIMITS.vote);
  const project = await votable((await params).id, user.id);
  const { walletAddress } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { walletAddress: true } });
  await assertCanVote(walletAddress);
  try {
    await prisma.projectVote.create({ data: { projectId: project.id, userId: user.id } });
  } catch (err) {
    // Already voted: voting is idempotent.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }
  return result(project.id, true);
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireSessionUser();
  await enforceRateLimit(`vote:${user.id}`, LIMITS.vote);
  const project = await votable((await params).id, user.id);
  await prisma.projectVote.deleteMany({ where: { projectId: project.id, userId: user.id } });
  return result(project.id, false);
});
