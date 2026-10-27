import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, requireProject, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { getPreviewStatus, refreshPreview } from "@/lib/runtime/preview";
import { isAgentRunning } from "@/lib/ai/agent";

export const runtime = "nodejs";
export const maxDuration = 300;

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  return NextResponse.json(await getPreviewStatus(project));
});

/** Rebuilds and (re)starts the preview container, e.g. after a server restart. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`preview:${user.id}`, LIMITS.deploy);
  if (isAgentRunning(project.id)) throw new ApiError(409, "Claude is working on this project.");
  const res = await refreshPreview(project);
  return NextResponse.json({ ok: res.ok, url: res.previewUrl, error: res.ok ? null : res.infrastructure ? res.errors : "Your application failed to build." });
});
