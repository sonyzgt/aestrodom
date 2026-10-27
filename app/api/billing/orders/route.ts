import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, parseJson, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { createOrder, orderJson } from "@/lib/billing/orders";

export const runtime = "nodejs";

const schema = z.object({ usd: z.number().positive().max(100_000) });

/** Starts a USD top-up. The response locks exactly how much $AESTRODOM to send, for 15 minutes. */
export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`billing:${user.id}`, LIMITS.billing);
  const { usd } = await parseJson(req, schema);
  const order = await createOrder(user.id, usd);
  return NextResponse.json({ order: orderJson(order) }, { status: 201 });
});
