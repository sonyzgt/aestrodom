import { NextResponse } from "next/server";
import { enforceRateLimit, requireProject, requireUser, route } from "@/lib/api";
import { checkSlug } from "@/lib/projects/slug-change";

export const runtime = "nodejs";

/** GET /api/projects/:id/slug?slug=jump -> is jump.{domain} available for this project? */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`slug:check:${user.id}`, { limit: 120, windowSec: 60 });
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  return NextResponse.json(await checkSlug(project.id, slug));
});
