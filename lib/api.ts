import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ZodError, type ZodType } from "zod";
import type { Project, User } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log, errorMessage } from "@/lib/logger";
import { rateLimit, type RateLimitOptions } from "@/lib/rate-limit";
import { PathError } from "@/lib/projects/paths";
import { userForApiKey } from "@/lib/billing/keys";

/** An error whose message is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "plan"> & {
  /** Set when the request was authenticated with a personal API key instead of the session cookie. */
  apiKeyId?: string;
};

/** The bearer token of `Authorization: Bearer …`, if any. */
function bearerToken(value: string | null) {
  const m = value?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

/**
 * Resolves the current user and re-validates against the database on every call. A request carrying
 * `Authorization: Bearer aestro_sk_…` is authenticated by that key only (never falls back to the cookie).
 */
export async function requireUser(): Promise<SessionUser> {
  const token = bearerToken((await headers()).get("authorization"));
  if (token) {
    const found = await userForApiKey(token);
    if (!found) throw new ApiError(401, "Invalid or revoked API key.", "invalid_api_key");
    const u = found.user;
    return { id: u.id, email: u.email, name: u.name, role: u.role, plan: u.plan, apiKeyId: found.keyId };
  }
  return requireSessionUser();
}

/** Like requireUser, but only the browser session counts (for managing keys and other account settings). */
export async function requireSessionUser(): Promise<SessionUser> {
  if (bearerToken((await headers()).get("authorization"))) throw new ApiError(403, "This endpoint can't be used with an API key.", "session_required");
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new ApiError(401, "Please sign in.");
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, plan: true, disabled: true },
  });
  if (!user || user.disabled) throw new ApiError(401, "Please sign in.");
  return { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(404, "Not found.");
  return user;
}

/**
 * Loads a project only if it belongs to `userId`. Returns 404 (not 403) for other users' projects
 * so project ids cannot be enumerated.
 */
export async function requireProject(projectId: string, userId: string): Promise<Project> {
  if (typeof projectId !== "string" || !/^[a-z0-9]{20,40}$/.test(projectId)) throw new ApiError(404, "Project not found.");
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new ApiError(404, "Project not found.");
  return project;
}

export async function enforceRateLimit(key: string, opts: RateLimitOptions) {
  const res = await rateLimit(key, opts);
  if (!res.ok) throw new ApiError(429, `Too many requests. Try again in ${res.resetSec}s.`, "rate_limited");
}

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite cookies). */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  // API-key requests carry no ambient credentials, so they can't be forged cross-site.
  if (bearerToken(req.headers.get("authorization"))) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; session cookie is still required
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, "Cross-origin request blocked.");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(403, "Cross-origin request blocked.");
  }
}

export async function parseJson<T>(req: Request, schema: ZodType<T>, maxBytes = 64 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "Request too large.");
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "Invalid JSON.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError(400, first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request.");
  }
  return parsed.data;
}

type RouteCtx<P> = { params: Promise<P> };

/** Wraps a route handler with origin checks and uniform, non-leaky error responses. */
export function route<P = Record<string, string>>(
  handler: (req: Request, ctx: RouteCtx<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      if (err instanceof PathError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
      }
      log.error("api.unhandled", { path: new URL(req.url).pathname, method: req.method, error: errorMessage(err) });
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}
