import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { previewBaseDomain, slugFromHost } from "@/lib/deployment/domain";

export const runtime = "nodejs";

/**
 * Caddy on-demand TLS "ask" endpoint. Caddy calls
 *   GET /api/internal/domain-check?domain=demo.aestrodom.org&secret=...
 * before issuing a certificate; 200 = allowed, anything else = refuse.
 * Only hosts of currently running deployments/previews get certificates, which prevents
 * certificate-issuance abuse against the wildcard DNS record.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? "";
  if (!env.caddyAskSecret || secret !== env.caddyAskSecret) return new Response("forbidden", { status: 403 });
  const domain = (url.searchParams.get("domain") ?? "").toLowerCase();

  const previewSlug = slugFromHost(domain, previewBaseDomain());
  if (previewSlug) {
    const p = await prisma.project.findUnique({ where: { slug: previewSlug }, select: { previewUrl: true } });
    return new Response(p?.previewUrl ? "ok" : "unknown", { status: p?.previewUrl ? 200 : 404 });
  }
  const slug = slugFromHost(domain);
  if (!slug) return new Response("unknown", { status: 404 });
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { deployments: { where: { kind: "PRODUCTION", status: "RUNNING" }, select: { id: true }, take: 1 } },
  });
  return new Response(project?.deployments.length ? "ok" : "unknown", { status: project?.deployments.length ? 200 : 404 });
}
