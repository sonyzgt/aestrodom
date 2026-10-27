import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { currentUserOrRedirect } from "@/lib/session";
import { prisma } from "@/lib/db";
import { planLimits } from "@/lib/plans";
import { aiUsageToday } from "@/lib/ai/usage";
import { TEMPLATES } from "@/lib/templates";
import { EmptyProjects, ProjectTiles, loadProjects } from "@/components/dashboard/project-list";
import { PromptStart } from "@/components/marketing/prompt-start";
import { Gauge } from "@/components/dashboard/gauge";
import { Corner, Frame } from "@/components/ui/corner";

export const metadata = { title: "Home" };

function greeting() {
  const h = new Date().getUTCHours();
  return h < 11 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardHome() {
  const user = await currentUserOrRedirect();
  const limits = planLimits(user.plan);
  const [recent, total, live, tokens, usage] = await Promise.all([
    loadProjects(user.id, { take: 6 }),
    prisma.project.count({ where: { userId: user.id } }),
    prisma.project.count({ where: { userId: user.id, deployments: { some: { kind: "PRODUCTION", status: "RUNNING" } } } }),
    prisma.ponsLaunch.count({ where: { project: { userId: user.id }, status: "LAUNCHED" } }),
    aiUsageToday(user.id),
  ]);
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      {/* Command deck: greeting, headline between corner brackets, a quick-create prompt and the counters. */}
      <section className="grid items-end gap-10 border-b border-border pb-10 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="shimmer text-[11px]">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </div>
          <Corner pos="tl" className="mt-6" />
          <h1 className="my-3 text-[clamp(1.9rem,3.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[0.08em]">
            What are we
            <br />
            making today?
          </h1>
          <Corner pos="bl" />
          <div className="mt-7">
            <PromptStart signedIn placeholder="A pricing page for my design agency…" className="max-w-xl" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-4">
          <Plate value={total} label="Apps" />
          <Plate value={live} label="Live" />
          <Plate value={tokens} label="Tokens" />
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[15px]">Recent apps</h2>
            {total > 0 && (
              <Link href="/dashboard/projects" className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.18em] text-subtle hover:text-fg">
                View all {total} <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
          {recent.length ? <ProjectTiles projects={recent} /> : <EmptyProjects message="Your workspace is empty." />}
        </section>

        <aside className="space-y-4">
          <div className="relative p-5">
            <Frame />
            <div className="shimmer text-[11px]">Today</div>
            <div className="mt-4 flex justify-around">
              <Gauge used={usage.requests} max={limits.maxAiRequestsPerDay} label="AI runs" />
              <Gauge used={total} max={limits.maxProjects} label="Apps" />
            </div>
            <p className="mt-4 text-center text-[12px] text-subtle">{user.plan === "PRO" ? "Pro plan" : "Free plan"} · resets 00:00 UTC</p>
          </div>
          <div className="border-t border-border pt-4">
            <div className="shimmer px-1 pb-2 text-[11px]">Quick starts</div>
            {TEMPLATES.slice(0, 4).map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/new?prompt=${encodeURIComponent(t.prompt)}`}
                className="group flex items-center justify-between gap-3 border-b border-border px-1 py-3 transition-colors last:border-b-0 hover:bg-inset"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold uppercase tracking-[0.1em]">{t.title}</span>
                  <span className="block truncate text-[12px] text-subtle">{t.blurb}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Plate({ value, label }: { value: number; label: string }) {
  return (
    <div className="relative px-5 py-4 text-center lg:min-w-[170px] lg:text-left">
      <Frame />
      <div className="font-[family-name:var(--font-display)] text-[28px] font-bold leading-none tabular-nums">{value.toLocaleString()}</div>
      <div className="mt-2 text-[10.5px] font-medium uppercase tracking-[0.2em] text-subtle">{label}</div>
    </div>
  );
}
