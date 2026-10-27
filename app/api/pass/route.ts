import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { enforceRateLimit, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { passStatus } from "@/lib/nft/pass";
import { log, errorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public Aestrodom Pass state: supply, mint status and, for `?wallet=`, today's free launch quota. */
export const GET = route(async (req) => {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await enforceRateLimit(`pass:status:${ip}`, LIMITS.passStatus);
  const wallet = new URL(req.url).searchParams.get("wallet");
  try {
    return NextResponse.json(await passStatus(wallet));
  } catch (err) {
    log.warn("pass.status.error", { error: errorMessage(err) });
    return NextResponse.json({ error: "Could not read the Aestrodom Pass from Robinhood Chain. Try again shortly." }, { status: 502 });
  }
});
