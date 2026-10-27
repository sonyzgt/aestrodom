import { NextResponse } from "next/server";
import { enforceRateLimit, requireUser, route } from "@/lib/api";
import { quoteTopup } from "@/lib/billing/price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How much $AESTRODOM a USD top-up costs right now, and the credits it buys. Nothing is reserved. */
export const GET = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`quote:${user.id}`, { limit: 60, windowSec: 60 });
  const usd = Number(new URL(req.url).searchParams.get("usd"));
  const q = await quoteTopup(usd);
  return NextResponse.json({ usd: q.usdCents / 100, credits: q.credits, amount: q.amount.toString(), tokenUsd: q.tokenUsd });
});
