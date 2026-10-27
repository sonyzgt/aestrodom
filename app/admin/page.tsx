import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/session";
import { Logo } from "@/components/brand";
import { Card } from "@/components/ui/misc";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

/** Admin overview. Role is re-read from the database; non-admins get a 404. */
export default async function AdminPage() {
  const user = await currentUserOrRedirect();
  if (user.role !== "ADMIN") notFound();

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [users, projects, live, launches, usage, recentUsers, recentLaunches, errors] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.deployment.count({ where: { kind: "PRODUCTION", status: "RUNNING" } }),
    prisma.ponsLaunch.count({ where: { status: "LAUNCHED" } }),
    prisma.usage.aggregate({ where: { createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true }, _count: true }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, email: true, walletAddress: true, privyId: true, role: true, plan: true, disabled: true, createdAt: true, _count: { select: { projects: true } } } }),
    prisma.ponsLaunch.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, symbol: true, status: true, tokenAddress: true, createdAt: true, project: { select: { slug: true } } } }),
    prisma.projectLog.findMany({ where: { level: "ERROR" }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, source: true, message: true, createdAt: true, projectId: true } }),
  ]);

  const stats = [
    ["Users", users],
    ["Projects", projects],
    ["Live deployments", live],
    ["Tokens launched", launches],
    ["AI requests (24h)", usage._count],
    ["AI tokens (24h)", (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0)],
  ] as const;

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center gap-3 border-b border-border px-5">
        <Logo href="/dashboard" /> <span className="text-sm text-muted">Admin</span>
      </header>
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {stats.map(([k, v]) => (
            <Card key={k} className="p-4">
              <div className="text-xs text-muted">{k}</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{v.toLocaleString()}</div>
            </Card>
          ))}
        </div>
        <Table title="Recent users" head={["User", "Role", "Plan", "Projects", "Status", "Joined"]} rows={recentUsers.map((u) => [u.email ?? u.walletAddress ?? u.privyId ?? "—", u.role, u.plan, String(u._count.projects), u.disabled ? "Disabled" : "Active", timeAgo(u.createdAt)])} />
        <Table title="Token launches" head={["Token", "Project", "Status", "Address", "When"]} rows={recentLaunches.map((l) => [`$${l.symbol}`, l.project.slug, l.status, l.tokenAddress ?? "—", timeAgo(l.createdAt)])} />
        <Table title="Recent errors" head={["Source", "Project", "Message", "When"]} rows={errors.map((e) => [e.source, e.projectId.slice(0, 10), e.message.slice(0, 120), timeAgo(e.createdAt)])} />
      </div>
    </div>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted">{title}</h2>
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-subtle">
            <tr>{head.map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && <tr><td className="px-4 py-4 text-muted" colSpan={head.length}>Nothing yet.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className="max-w-xs truncate px-4 py-2.5">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
