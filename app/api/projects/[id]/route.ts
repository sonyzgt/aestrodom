import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseJson, requireProject, requireUser, route } from "@/lib/api";
import { getProjectDomain } from "@/lib/deployment/domain";
import { changeProjectSlug } from "@/lib/projects/slug-change";
import { removeContainer } from "@/lib/runtime/docker";
import { removeProject } from "@/lib/projects/filesystem";
import { isAgentRunning } from "@/lib/ai/agent";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
type Params = { id: string };

export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      framework: project.framework,
      status: project.status,
      previewUrl: project.previewUrl,
      deploymentUrl: project.deploymentUrl,
      logoUrl: project.logoUrl,
      skills: project.skills,
      domain: getProjectDomain(project.slug),
      lastBuildOk: project.lastBuildOk,
      agentRunning: isAgentRunning(project.id),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  slug: z.string().trim().toLowerCase().max(48).optional(),
  listed: z.boolean().optional(),
  logoUrl: z
    .string()
    .trim()
    .max(512)
    .refine((v) => v === "" || /^https:\/\//.test(v), "must be an https URL")
    .optional(),
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  const body = await parseJson(req, patchSchema);
  const data: { name?: string; description?: string; logoUrl?: string | null; listed?: boolean } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;
  if (body.listed !== undefined) data.listed = body.listed;

  if (body.slug !== undefined && body.slug !== project.slug) {
    const live = await prisma.deployment.count({ where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" } });
    if (live > 0) throw new ApiError(409, "Change the URL from the Deploy dialog, which moves the live site for you.");
    await changeProjectSlug(project, body.slug);
  }

  try {
    const updated = await prisma.project.update({ where: { id: project.id }, data });
    return NextResponse.json({ project: { id: updated.id, name: updated.name, slug: updated.slug, description: updated.description, logoUrl: updated.logoUrl, domain: getProjectDomain(updated.slug) } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ApiError(409, "That URL is already taken.");
    throw err;
  }
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  if (isAgentRunning(project.id)) throw new ApiError(409, "Wait for Claude to finish before deleting this project.");
  await Promise.all([removeContainer(project.id, "preview"), removeContainer(project.id, "production")]).catch(() => undefined);
  await prisma.project.delete({ where: { id: project.id } });
  await removeProject(project.id);
  log.info("project.deleted", { userId: user.id, projectId: project.id });
  return NextResponse.json({ ok: true });
});
