#!/usr/bin/env node
// Promotes an existing user to ADMIN.
// Usage: node scripts/make-admin.mjs <email | did:privy:... | 0xWallet>
import { PrismaClient } from "@prisma/client";

const id = process.argv[2]?.trim();
if (!id) {
  console.error("Usage: node scripts/make-admin.mjs <email | did:privy:... | 0xWallet>");
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
  await prisma.user.update({ where: { id: users[0].id }, data: { role: "ADMIN" } });
  console.log(`Promoted ${id} to ADMIN`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
