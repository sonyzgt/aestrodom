import { NextResponse } from "next/server";
import { requireProject, requireUser, route } from "@/lib/api";
import { recentLogs } from "@/lib/projects/logs";

export const runtime = "nodejs";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  return NextResponse.json({ logs: await recentLogs(project.id) });
});
