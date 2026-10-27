import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, enforceRateLimit, parseJson, requireProject, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { deployProject } from "@/lib/deployment";
import { isAgentRunning } from "@/lib/ai/agent";
import { changeProjectSlug } from "@/lib/projects/slug-change";
import { refreshPreview } from "@/lib/runtime/preview";
import { log, errorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({ slug: z.string().trim().toLowerCase().max(48).optional() });

/** Deploys the project, optionally moving it to a new subdomain first (availability re-checked here). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  let project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`deploy:${user.id}`, LIMITS.deploy);
  const body = await parseJson(req, schema, 1024);
  if (isAgentRunning(project.id)) throw new ApiError(409, "Wait for Claude to finish before deploying.");
  if (project.status === "CREATING") throw new ApiError(409, "The project has not been generated yet.");

  const slugChanged = !!body.slug && body.slug !== project.slug;
  if (slugChanged) project = await changeProjectSlug(project, body.slug!);

  const result = await deployProject(project);
  if (slugChanged) {
    // The preview moved to the new subdomain too; rebuild it in the background.
    const p = project;
    refreshPreview(p).catch((err) => log.warn("preview.refresh_after_slug.error", { projectId: p.id, error: errorMessage(err) }));
  }
  return NextResponse.json({ ...result, slug: project.slug, slugChanged }, { status: result.ok ? 200 : 422 });
});
