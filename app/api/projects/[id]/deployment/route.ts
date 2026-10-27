import { NextResponse } from "next/server";
import { requireProject, requireUser, route } from "@/lib/api";
import { getDeploymentStatus } from "@/lib/deployment";

export const runtime = "nodejs";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  return NextResponse.json(await getDeploymentStatus(project));
});
