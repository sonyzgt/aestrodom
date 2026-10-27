import "server-only";
import { prisma } from "@/lib/db";
import { ApiError, type SessionUser } from "@/lib/api";
import { planLimits } from "@/lib/plans";
import { uniqueSlug } from "@/lib/slug";
import { getProjectDomain } from "@/lib/deployment/domain";
import { createProject as createProjectFiles, removeProject } from "./filesystem";
import { log } from "@/lib/logger";
import { inferProjectName } from "./naming";
import { normalizeSkills } from "@/lib/skills";

export { inferProjectName } from "./naming";

export async function createProjectForUser(user: SessionUser, input: { prompt: string; name?: string; skills?: string[] }) {
  const limits = planLimits(user.plan);
  const count = await prisma.project.count({ where: { userId: user.id } });
  if (count >= limits.maxProjects) {
    throw new ApiError(403, `Your plan allows ${limits.maxProjects} projects. Delete one to create another.`, "project_limit");
  }

  const name = (input.name?.trim() || inferProjectName(input.prompt)).slice(0, 60);
  const description = input.prompt.trim().replace(/\s+/g, " ").slice(0, 280);

  // Slug allocation can race with another request; retry on unique violations.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = await uniqueSlug(name, async (s) => !!(await prisma.project.findUnique({ where: { slug: s }, select: { id: true } })));
    try {
      const project = await prisma.$transaction(async (tx) => {
        const p = await tx.project.create({
          data: { userId: user.id, name, slug, description, status: "CREATING", initialPrompt: input.prompt.trim(), skills: normalizeSkills(input.skills) },
        });
        await tx.conversation.create({ data: { projectId: p.id } });
        await tx.projectDomain.create({ data: { projectId: p.id, domain: getProjectDomain(slug), primary: true } });
        return p;
      });
      try {
        await createProjectFiles(project.id);
      } catch (err) {
        await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
        await removeProject(project.id).catch(() => undefined);
        throw err;
      }
      log.info("project.created", { userId: user.id, projectId: project.id, slug });
      return project;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") continue;
      throw err;
    }
  }
  throw new ApiError(409, "Could not allocate a project URL. Try a different name.");
}
