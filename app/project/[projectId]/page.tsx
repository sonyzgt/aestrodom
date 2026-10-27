import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/session";
import { getProjectDomain } from "@/lib/deployment/domain";
import { Builder } from "@/components/builder/builder";
import { normalizeSkills } from "@/lib/skills";
import type { ChatMessage } from "@/components/builder/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  return { title: p?.name ?? "Project" };
}

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await currentUserOrRedirect();
  const { projectId } = await params;
  // Ownership check: other users' projects are indistinguishable from missing ones.
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!project) notFound();

  const [messages, liveDeployment, lastFileChange] = await Promise.all([
    prisma.message.findMany({
      where: { conversation: { projectId: project.id }, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.deployment.findFirst({
      where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.projectFile.aggregate({ where: { projectId: project.id }, _max: { updatedAt: true } }),
  ]);
  // Files edited after the live build started mean the live site shows an older version.
  const lastEdit = lastFileChange._max.updatedAt;
  const outdated = !!liveDeployment && !!lastEdit && lastEdit > liveDeployment.createdAt;

  const initialMessages: ChatMessage[] = messages.map((m) => {
    const meta = (m.metadata ?? {}) as { activity?: string[]; error?: boolean; buildOk?: boolean | null; buildUnavailable?: boolean };
    return {
      id: m.id,
      role: m.role as "USER" | "ASSISTANT",
      content: m.content,
      error: !!meta.error,
      activity: (meta.activity ?? []).map((label, i) => ({ id: `${m.id}-${i}`, label, status: "done" as const })),
      build:
        m.role === "ASSISTANT" && meta.buildUnavailable
          ? { status: "unavailable" }
          : m.role === "ASSISTANT" && meta.buildOk
            ? { status: "ok" }
            : undefined,
    };
  });

  return (
    <Builder
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.status === "CREATING" ? (project.initialPrompt ?? project.description) : project.description,
        status: project.status,
        previewUrl: project.previewUrl,
        deploymentUrl: project.deploymentUrl,
        domain: getProjectDomain(project.slug),
        logoUrl: project.logoUrl,
        skills: normalizeSkills(project.skills),
      }}
      initialMessages={initialMessages}
      deployed={!!liveDeployment}
      outdated={outdated}
      userInitial={(user.name || user.email || "P").charAt(0).toUpperCase()}
    />
  );
}
