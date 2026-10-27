import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/session";
import { baseDomain, getProjectDomain } from "@/lib/deployment/domain";
import { explorerAddress, explorerTx } from "@/lib/chains/robinhood";
import { Card, StatusDot } from "@/components/ui/misc";
import { Logo } from "@/components/brand";
import { DangerZone, GeneralSettingsForm } from "@/components/builder/settings-form";

export const metadata = { title: "Project settings" };
export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await currentUserOrRedirect();
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!project) notFound();

  const [deployment, launch] = await Promise.all([
    prisma.deployment.findFirst({ where: { projectId: project.id, kind: "PRODUCTION" }, orderBy: { createdAt: "desc" } }),
    prisma.ponsLaunch.findFirst({ where: { projectId: project.id, status: "LAUNCHED" } }),
  ]);
  const live = deployment?.status === "RUNNING";
  const slugLocked = launch
    ? "The URL is recorded in your token's metadata and can't be changed."
    : live
      ? "Stop the deployment to change the URL."
      : null;

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center gap-4 border-b border-border px-5">
        <Logo href="/dashboard" />
        <span className="text-border-strong">/</span>
        <Link href={`/project/${project.id}`} className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> {project.name}
        </Link>
      </header>
      <div className="mx-auto max-w-3xl space-y-10 px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

        <Section title="General">
          <GeneralSettingsForm
            projectId={project.id}
            initial={{ name: project.name, slug: project.slug, description: project.description, logoUrl: project.logoUrl ?? "", listed: project.listed }}
            slugLocked={slugLocked}
            domainSuffix={baseDomain()}
          />
        </Section>

        <Section title="Deployment">
          <Rows
            rows={[
              ["Domain", getProjectDomain(project.slug)],
              ["Status", <span key="s" className="flex items-center gap-1.5"><StatusDot tone={live ? "success" : "neutral"} />{live ? "Live" : deployment?.status === "FAILED" ? "Last deploy failed" : "Not deployed"}</span>],
              ["URL", project.deploymentUrl ? <a key="u" className="flex items-center gap-1 hover:underline" href={project.deploymentUrl} target="_blank" rel="noopener noreferrer">{project.deploymentUrl}<ExternalLink className="size-3" /></a> : "—"],
            ]}
          />
        </Section>

        <Section title="Token">
          {launch ? (
            <Rows
              rows={[
                ["Token", `$${launch.symbol}`],
                ["Token address", <a key="t" className="font-mono text-[13px] hover:underline" href={explorerAddress(launch.tokenAddress!)} target="_blank" rel="noopener noreferrer">{launch.tokenAddress}</a>],
                ["Curve address", <a key="c" className="font-mono text-[13px] hover:underline" href={explorerAddress(launch.curveAddress!)} target="_blank" rel="noopener noreferrer">{launch.curveAddress}</a>],
                ["Launch transaction", <a key="x" className="font-mono text-[13px] hover:underline" href={explorerTx(launch.transactionHash)} target="_blank" rel="noopener noreferrer">{launch.transactionHash.slice(0, 18)}…</a>],
              ]}
            />
          ) : (
            <p className="p-5 text-sm text-muted">No token launched. Deploy your project, then use “Launch Token” in the builder.</p>
          )}
        </Section>

        <Section title="Danger Zone" danger>
          <DangerZone projectId={project.id} name={project.name} hasToken={!!launch} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section>
      <h2 className={`mb-3 text-sm font-medium ${danger ? "text-danger" : "text-muted"}`}>{title}</h2>
      <Card className={danger ? "border-danger/25" : ""}>{children}</Card>
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="divide-y divide-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm">
          <span className="text-muted">{k}</span>
          <span className="min-w-0 truncate">{v}</span>
        </div>
      ))}
    </div>
  );
}
