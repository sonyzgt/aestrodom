import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/api";
import { creditBalance } from "@/lib/billing/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who the session or API key belongs to, and the credit balance. Handy for checking a key works. */
export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    credits: await creditBalance(user.id),
    auth: user.apiKeyId ? "api_key" : "session",
  });
});
