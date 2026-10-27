import "server-only";
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getPreviewDomain } from "@/lib/deployment/domain";
import { buildProject, type BuildResult } from "./build";
import { containerInfo, stopContainer } from "./docker";

/**
 * Live preview.
 *
 * Supported project type for the MVP: Vite + React + TypeScript + Tailwind (static HTML/CSS/JS also
 * works since it is a subset). Each project gets a long-lived preview container; every successful
 * build atomically swaps the served site, so the iframe always shows the last good build.
 *
 * URLs:
 *  - local:      http://127.0.0.1:{randomPort}   (published on loopback only)
 *  - production: https://{slug}.{PRISMATIC_PREVIEW_DOMAIN} via Caddy over the internal network
 *
 * The preview is a different site from the Prismatic app origin and is embedded in a sandboxed
 * iframe without `allow-same-origin`, so preview code can never touch the user's Prismatic session.
 */
export function previewUrlFor(slug: string, hostPort: number | null): string | null {
  if (env.deploymentMode === "production") return `https://${getPreviewDomain(slug)}`;
  return hostPort ? `http://127.0.0.1:${hostPort}` : null;
}

export async function refreshPreview(project: Pick<Project, "id" | "slug">): Promise<BuildResult & { previewUrl: string | null }> {
  const result = await buildProject(project.id, project.slug, "preview");
  const previewUrl = previewUrlFor(project.slug, result.hostPort);
  if (!result.infrastructure) {
    await prisma.$transaction([
      prisma.project.update({ where: { id: project.id }, data: { previewUrl } }),
      prisma.deployment.create({
        data: {
          projectId: project.id,
          kind: "PREVIEW",
          status: result.ok ? "RUNNING" : "FAILED",
          containerName: `prismatic-preview-${project.id}`,
          hostPort: result.hostPort,
          url: previewUrl,
          error: result.ok ? null : result.errors.slice(0, 4000),
          startedAt: new Date(),
        },
      }),
    ]);
  }
  return { ...result, previewUrl };
}

/** Current preview state, from the container itself (never trusted from the client). */
export async function getPreviewStatus(project: Pick<Project, "id" | "slug">) {
  const info = await containerInfo(project.id, "preview").catch(() => null);
  return {
    running: !!info?.running,
    url: info?.running ? previewUrlFor(project.slug, info.hostPort) : null,
  };
}

export async function stopPreview(projectId: string) {
  await stopContainer(projectId, "preview");
}
