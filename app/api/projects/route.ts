import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { enforceRateLimit, parseJson, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { createProjectForUser } from "@/lib/projects/service";
import { getProjectDomain } from "@/lib/deployment/domain";
import { SKILL_IDS } from "@/lib/skills";

export const runtime = "nodejs";

export const GET = route(async () => {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      deploymentUrl: true,
      updatedAt: true,
      ponsLaunches: { where: { status: "LAUNCHED" }, select: { symbol: true, tokenAddress: true }, take: 1 },
    },
  });
  return NextResponse.json({
    projects: projects.map((p) => ({ ...p, domain: getProjectDomain(p.slug), token: p.ponsLaunches[0] ?? null, ponsLaunches: undefined })),
  });
});

const createSchema = z.object({
  prompt: z.string().trim().min(8, "describe what you want to build").max(Number(process.env.MAX_PROMPT_CHARS || 8000)),
  name: z.string().trim().max(60).optional(),
  skills: z.array(z.enum(SKILL_IDS)).max(SKILL_IDS.length).optional(),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`project:create:${user.id}`, LIMITS.projectCreate);
  const body = await parseJson(req, createSchema);
  const project = await createProjectForUser(user, body);
  return NextResponse.json({ id: project.id, slug: project.slug }, { status: 201 });
});
