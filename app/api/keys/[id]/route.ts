import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, requireSessionUser, route } from "@/lib/api";

export const runtime = "nodejs";

/** Revokes a key immediately. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireSessionUser();
  const res = await prisma.apiKey.updateMany({ where: { id: (await params).id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (res.count === 0) throw new ApiError(404, "Key not found.");
  return NextResponse.json({ ok: true });
});
