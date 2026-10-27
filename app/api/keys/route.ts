import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, enforceRateLimit, parseJson, requireSessionUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { MAX_ACTIVE_KEYS, generateKey } from "@/lib/billing/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const keyJson = (k: { id: string; name: string; prefix: string; lastUsedAt: Date | null; createdAt: Date }) => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  createdAt: k.createdAt.toISOString(),
});

export const GET = route(async () => {
  const user = await requireSessionUser();
  const keys = await prisma.apiKey.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ keys: keys.map(keyJson) });
});

const schema = z.object({ name: z.string().trim().min(1).max(60) });

/** Creates a key. The full key is in this response only; afterwards just its prefix is shown. */
export const POST = route(async (req) => {
  const user = await requireSessionUser();
  await enforceRateLimit(`keys:${user.id}`, LIMITS.apiKeys);
  const { name } = await parseJson(req, schema);
  const active = await prisma.apiKey.count({ where: { userId: user.id, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS) throw new ApiError(409, `You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
  const { key, hash, prefix } = generateKey();
  const row = await prisma.apiKey.create({ data: { userId: user.id, name, prefix, hash } });
  return NextResponse.json({ key, apiKey: keyJson(row) }, { status: 201 });
});
