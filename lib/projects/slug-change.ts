import "server-only";
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { isValidSlug, RESERVED_SLUGS } from "@/lib/slug";
import { getProjectDomain } from "@/lib/deployment/domain";
import { removeContainer, stopContainer } from "@/lib/runtime/docker";
import { addLog } from "@/lib/projects/logs";
import { log } from "@/lib/logger";

export type SlugCheck =
  | { available: true; slug: string; domain: string; current: boolean }
  | { available: false; slug: string; reason: string };

/** Whether `slug` could become this project's subdomain. Read-only. */
export async function checkSlug(projectId: string, raw: string): Promise<SlugCheck> {
  const slug = raw.trim().toLowerCase();
  if (!slug) return { available: false, slug, reason: "Enter a name." };
  if (slug.length > 48) return { available: false, slug, reason: "Use at most 48 characters." };
  if (RESERVED_SLUGS.has(slug)) return { available: false, slug, reason: "This name is reserved." };
  if (!isValidSlug(slug)) {
    return { available: false, slug, reason: "Use lowercase letters, numbers and single hyphens; start and end with a letter or number." };
  }
  const owner = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (owner && owner.id !== projectId) return { available: false, slug, reason: "Already taken by another project." };
  return { available: true, slug, domain: getProjectDomain(slug), current: owner?.id === projectId };
}

/**
 * Moves a project to a new subdomain. If the project is live, the old site is stopped first
 * (the caller redeploys). Blocked once a token is launched, because the URL is in its on-chain metadata.
 */
export async function changeProjectSlug(project: Project, raw: string): Promise<Project> {
  const check = await checkSlug(project.id, raw);
  if (!check.available) throw new ApiError(check.reason.startsWith("Already taken") ? 409 : 400, check.reason);
  if (check.current) return project;

  const launched = await prisma.ponsLaunch.count({ where: { projectId: project.id, status: "LAUNCHED" } });
  if (launched > 0) throw new ApiError(409, "This project's URL is recorded in its token metadata and cannot be changed.");

  const oldDomain = getProjectDomain(project.slug);
  const live = await prisma.deployment.count({ where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" } });
  if (live > 0) await stopContainer(project.id, "production").catch(() => undefined);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (live > 0) {
        await tx.deployment.updateMany({
          where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" },
          data: { status: "STOPPED", stoppedAt: new Date() },
        });
      }
      await tx.projectDomain.deleteMany({ where: { projectId: project.id } });
      await tx.projectDomain.create({ data: { projectId: project.id, domain: check.domain, primary: true } });
      return tx.project.update({
        where: { id: project.id },
        data: { slug: check.slug, previewUrl: null, ...(live > 0 ? { status: "READY", deploymentUrl: null } : {}) },
      });
    });
    // Containers carry the old network alias; they are recreated on the next build.
    await Promise.all([removeContainer(project.id, "preview"), removeContainer(project.id, "production")]).catch(() => undefined);
    await addLog(project.id, "DEPLOY", "INFO", `URL changed: ${oldDomain} → ${check.domain}`);
    log.info("project.slug_changed", { projectId: project.id, from: project.slug, to: check.slug });
    return updated;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ApiError(409, "Already taken by another project.");
    throw err;
  }
}
