#!/usr/bin/env node
// Adds (or with a negative number, removes) credits for a user and records it in the ledger.
// Usage: node scripts/grant-credits.mjs <email | did:privy:... | 0xWallet> <credits>
import { PrismaClient } from "@prisma/client";

const id = process.argv[2]?.trim();
const delta = Number(process.argv[3]);
if (!id || !Number.isInteger(delta) || delta === 0) {
  console.error("Usage: node scripts/grant-credits.mjs <email | did:privy:... | 0xWallet> <credits>");
  process.exit(1);
}
const where = id.startsWith("did:privy:")
  ? { privyId: id }
  : /^0x[0-9a-fA-F]{40}$/.test(id)
    ? { walletAddress: { equals: id, mode: "insensitive" } }
    : { email: id.toLowerCase() };

const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({ where, select: { id: true } });
  if (users.length !== 1) throw new Error(users.length ? "More than one user matches" : "No matching user");
  const userId = users[0].id;
  const balance = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: userId }, data: { credits: { increment: delta } }, select: { credits: true } });
    await tx.creditLedger.create({ data: { userId, delta, balanceAfter: u.credits, reason: "admin" } });
    return u.credits;
  });
  console.log(`${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} credits for ${id}. Balance: ${balance}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
