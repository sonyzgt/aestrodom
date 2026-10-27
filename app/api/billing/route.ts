import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import { billingConfig, orderJson } from "@/lib/billing/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Credit balance, purchase terms, recent orders and recent balance changes. */
export const GET = route(async () => {
  const user = await requireUser();
  const [u, orders, ledger] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { credits: true } }),
    prisma.creditOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({
    credits: u.credits,
    config: billingConfig(),
    orders: orders.map(orderJson),
    ledger: ledger.map((l) => ({ id: l.id, delta: l.delta, balanceAfter: l.balanceAfter, reason: l.reason, createdAt: l.createdAt.toISOString() })),
  });
});
