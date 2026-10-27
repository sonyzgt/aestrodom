import "server-only";
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { addLog } from "@/lib/projects/logs";
import { listFiles } from "@/lib/projects/filesystem";
import { buildProject } from "@/lib/runtime/build";
import { containerInfo, restartContainer, stopContainer } from "@/lib/runtime/docker";
import { getProjectDomain, getProjectUrl } from "./domain";

export { getProjectDomain, getProjectUrl } from "./domain";

export interface DeployStep {
  label: string;
  ok: boolean;
}

export interface DeployResult {
  ok: boolean;
  url: string | null;
  domain: string;
  steps: DeployStep[];
  error?: string;
}

function publicUrl(slug: string, hostPort: number | null): string | null {
  if (env.deploymentMode === "production") return getProjectUrl(slug);
  return hostPort ? `http://127.0.0.1:${hostPort}` : null;
}

/**
 * Validate -> build in the production container -> start -> register hostname.
 * The production container is separate from the preview one, so editing the project afterwards
 * never changes the live site until the next deploy. Rebuilds swap the served directory atomically,
 * so redeploys have no downtime and a failed redeploy keeps the previous version online.
 */
export async function deployProject(project: Project): Promise<DeployResult> {
  const domain = getProjectDomain(project.slug);
  const steps: DeployStep[] = [];

  const files = await listFiles(project.id);
  if (!files.some((f) => f.path === "index.html") || !files.some((f) => f.path.startsWith("src/"))) {
    return { ok: false, url: null, domain, steps, error: "Project is missing index.html or src/." };
  }

  const deployment = await prisma.deployment.create({
    data: { projectId: project.id, kind: "PRODUCTION", status: "BUILDING", containerName: `prismatic-prod-${project.id}` },
  });
  await addLog(project.id, "DEPLOY", "INFO", `Deploying ${domain}`);

  const build = await buildProject(project.id, project.slug, "production");
  steps.push({ label: "Build successful", ok: build.ok });
  if (!build.ok) {
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "FAILED", error: build.errors.slice(0, 4000) },
    });
    log.warn("deploy.failed", { projectId: project.id, stage: "build" });
    return { ok: false, url: null, domain, steps, error: build.infrastructure ? build.errors : "Deployment failed: the application did not build." };
  }

  const info = await containerInfo(project.id, "production");
  steps.push({ label: "Container started", ok: !!info?.running });
  if (!info?.running) {
    await prisma.deployment.update({ where: { id: deployment.id }, data: { status: "FAILED", error: "Container not running" } });
    return { ok: false, url: null, domain, steps, error: "Deployment failed: container did not start." };
  }

  const url = publicUrl(project.slug, info.hostPort);
  await prisma.$transaction([
    prisma.deployment.updateMany({
      where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING", id: { not: deployment.id } },
      data: { status: "STOPPED", stoppedAt: new Date() },
    }),
    prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "RUNNING", hostPort: info.hostPort, url, startedAt: new Date() },
    }),
    prisma.projectDomain.upsert({
      where: { domain },
      create: { projectId: project.id, domain, primary: true },
      update: {},
    }),
    prisma.project.update({ where: { id: project.id }, data: { status: "DEPLOYED", deploymentUrl: url } }),
  ]);
  // In production the proxy resolves {slug}.domain -> site-{slug} on the project network and
  // issues the certificate on demand after asking /api/internal/domain-check.
  steps.push({ label: "Domain configured", ok: true });
  await addLog(project.id, "DEPLOY", "SUCCESS", `Live at ${url}`);
  log.info("deploy.succeeded", { projectId: project.id, domain });
  return { ok: true, url, domain, steps };
}

export async function stopProject(project: Project) {
  await stopContainer(project.id, "production");
  await prisma.$transaction([
    prisma.deployment.updateMany({
      where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" },
      data: { status: "STOPPED", stoppedAt: new Date() },
    }),
    prisma.project.update({ where: { id: project.id }, data: { status: "READY", deploymentUrl: null } }),
  ]);
  await addLog(project.id, "DEPLOY", "INFO", "Deployment stopped");
  log.info("deploy.stopped", { projectId: project.id });
}

export async function restartProject(project: Project) {
  const ok = await restartContainer(project.id, "production");
  await addLog(project.id, "DEPLOY", ok ? "INFO" : "WARN", ok ? "Deployment restarted" : "No deployment to restart");
  return ok;
}

/** Combines the database record with the live container state. */
export async function getDeploymentStatus(project: Project) {
  const latest = await prisma.deployment.findFirst({
    where: { projectId: project.id, kind: "PRODUCTION" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, url: true, error: true, createdAt: true, startedAt: true },
  });
  const info = await containerInfo(project.id, "production").catch(() => null);
  return {
    domain: getProjectDomain(project.slug),
    url: project.deploymentUrl,
    containerRunning: !!info?.running,
    deployment: latest,
    live: latest?.status === "RUNNING" && !!info?.running,
  };
}
