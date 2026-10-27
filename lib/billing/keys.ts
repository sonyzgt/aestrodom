import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/** Personal API keys: `aestro_sk_` + 40 base62 characters. Only the SHA-256 hash is stored. */
export const KEY_PREFIX = "aestro_sk_";
export const MAX_ACTIVE_KEYS = 10;

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateKey() {
  // Rejection sampling keeps every character uniformly distributed.
  let body = "";
  while (body.length < 40) {
    for (const b of randomBytes(48)) {
      if (b < 248 && body.length < 40) body += ALPHABET[b % 62];
    }
  }
  const key = KEY_PREFIX + body;
  return { key, hash: hashKey(key), prefix: key.slice(0, KEY_PREFIX.length + 6) };
}

export function looksLikeKey(value: string) {
  return value.startsWith(KEY_PREFIX) && /^aestro_sk_[0-9A-Za-z]{40}$/.test(value);
}

/** Resolves an API key to its active owner, or null. Touches `lastUsedAt` at most once a minute. */
export async function userForApiKey(key: string) {
  if (!looksLikeKey(key)) return null;
  const row = await prisma.apiKey.findUnique({
    where: { hash: hashKey(key) },
    select: {
      id: true,
      revokedAt: true,
      lastUsedAt: true,
      user: { select: { id: true, email: true, name: true, role: true, plan: true, disabled: true } },
    },
  });
  if (!row || row.revokedAt || row.user.disabled) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { keyId: row.id, user: row.user };
}
