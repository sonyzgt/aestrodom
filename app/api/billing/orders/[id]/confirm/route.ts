import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, parseJson, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { confirmOrder, orderJson } from "@/lib/billing/orders";
import { creditBalance } from "@/lib/billing/credits";

export const runtime = "nodejs";

const schema = z.object({ txHash: z.string().trim() });

/** Verifies the payment on Robinhood Chain and adds the credits. Safe to call again with the same hash. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  await enforceRateLimit(`billing:${user.id}`, LIMITS.billing);
  const { txHash } = await parseJson(req, schema);
  const { order, credited } = await confirmOrder(user.id, (await params).id, txHash);
  return NextResponse.json({ order: orderJson(order), credited, credits: await creditBalance(user.id) });
});
