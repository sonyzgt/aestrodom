import { NextResponse } from "next/server";
import { requireProject, requireUser, route } from "@/lib/api";
import { stopProject } from "@/lib/deployment";

export const runtime = "nodejs";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await stopProject(project);
  return NextResponse.json({ ok: true });
});
