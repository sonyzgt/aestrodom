import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProject, requireUser, route } from "@/lib/api";

export const runtime = "nodejs";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  const messages = await prisma.message.findMany({
    where: { conversation: { projectId: project.id }, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, role: true, content: true, metadata: true, createdAt: true },
  });
  return NextResponse.json({ messages });
});
