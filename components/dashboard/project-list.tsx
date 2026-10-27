import Link from "next/link";
import { ArrowUpRight, Coins, Globe, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProjectDomain } from "@/lib/deployment/domain";
import { cn, timeAgo } from "@/lib/utils";

export type ProjectStatus = "CREATING" | "READY" | "BUILDING" | "DEPLOYED" | "ERROR";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  domain: string;
  deployed: boolean;
  updatedAt: Date;
  token: { symbol: string } | null;
};

const STATUS: Record<ProjectStatus, { label: string; className: string }> = {
  CREATING: { label: "Creating", className: "border-accent-blue/40 text-accent-blue" },
  READY: { label: "Draft", className: "border-border-strong text-muted" },
  BUILDING: { label: "Building", className: "border-warning/40 text-warning" },
  DEPLOYED: { label: "Live", className: "border-success/40 text-success" },
  ERROR: { label: "Error", className: "border-danger/40 text-danger" },
};

export const STATUS_FILTERS = ["all", "live", "draft", "error"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const FILTER_WHERE: Record<StatusFilter, ProjectStatus[] | null> = {
  all: null,
  live: ["DEPLOYED"],
  draft: ["READY", "CREATING", "BUILDING"],
  error: ["ERROR"],
};

export async function loadProjects(userId: string, { take, filter = "all" }: { take?: number; filter?: StatusFilter } = {}): Promise<ProjectSummary[]> {
  const statuses = FILTER_WHERE[filter];
  const projects = await prisma.project.findMany({
    where: { userId, ...(statuses ? { status: { in: statuses } } : {}) },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      slug: true,
      updatedAt: true,
      deployments: { where: { kind: "PRODUCTION", status: "RUNNING" }, select: { id: true }, take: 1 },
      ponsLaunches: { where: { status: "LAUNCHED" }, select: { symbol: true }, take: 1 },
    },
  });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    domain: getProjectDomain(p.slug),
    deployed: p.deployments.length > 0,
    updatedAt: p.updatedAt,
    token: p.ponsLaunches[0] ?? null,
  }));
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-[4px] border bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", s.className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

/** Large tiles with a monogram over a square grid, used for recent work on the home screen. */
export function ProjectTiles({ projects }: { projects: ProjectSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => (
        <Link key={p.id} href={`/project/${p.id}`} className="panel group flex flex-col overflow-hidden rounded-md transition-colors hover:border-fg">
          <div className="grid-squares relative flex h-32 items-center justify-center border-b border-border bg-inset">
            <span className="text-heading font-[family-name:var(--font-display)] text-[48px] font-black leading-none tracking-[0.04em]">
              {p.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="absolute left-3 top-3">
              <StatusPill status={p.status} />
            </span>
            <ArrowUpRight className="absolute right-3 top-3 size-4 text-subtle transition-colors group-hover:text-fg" />
          </div>
          <div className="flex flex-1 flex-col p-4">
            <div className="truncate text-[14px] font-semibold uppercase tracking-[0.12em]">{p.name}</div>
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{p.description || "No description yet."}</p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[12px] text-subtle">
              <span className={cn("flex min-w-0 items-center gap-1.5", p.deployed && "text-fg/80")}>
                <Globe className="size-3.5 shrink-0" />
                <span className="truncate">{p.domain}</span>
              </span>
              <span className="shrink-0">{timeAgo(p.updatedAt)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Dense table of every project, used on the Projects screen. */
export function ProjectRows({ projects }: { projects: ProjectSummary[] }) {
  return (
    <div className="panel overflow-hidden rounded-md">
      <div className="hidden grid-cols-[minmax(0,2fr)_120px_minmax(0,1.4fr)_110px_110px] gap-4 border-b border-border bg-inset/60 px-5 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.2em] text-subtle md:grid">
        <span>App</span>
        <span>Status</span>
        <span>Address</span>
        <span>Token</span>
        <span className="text-right">Updated</span>
      </div>
      <ul className="divide-y divide-border">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/project/${p.id}`}
              className="grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-elevated/60 md:grid-cols-[minmax(0,2fr)_120px_minmax(0,1.4fr)_110px_110px] md:items-center md:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-fg font-[family-name:var(--font-display)] text-[12px] font-bold text-bg">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold uppercase tracking-[0.1em]">{p.name}</div>
                  <div className="truncate text-[12.5px] text-subtle">{p.description || "No description yet."}</div>
                </div>
              </div>
              <div>
                <StatusPill status={p.status} />
              </div>
              <div className={cn("flex min-w-0 items-center gap-1.5 text-[13px]", p.deployed ? "text-fg/85" : "text-subtle")}>
                <Globe className="size-3.5 shrink-0" />
                <span className="truncate">{p.domain}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[13px]">
                <Coins className="size-3.5 text-subtle" />
                {p.token ? <span className="font-mono font-medium">${p.token.symbol}</span> : <span className="text-subtle">—</span>}
              </div>
              <div className="text-[12.5px] text-subtle md:text-right">{timeAgo(p.updatedAt)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyProjects({ message = "No apps here yet." }: { message?: string }) {
  return (
    <div className="panel grid-squares flex flex-col items-center justify-center rounded-md px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-border-strong bg-elevated shadow-[inset_0_1px_0_var(--sheen)]">
        <Plus className="size-5" />
      </span>
      <div className="mt-4 text-[16px] font-semibold">{message}</div>
      <p className="mt-1 text-[14px] text-muted">Describe an idea and Claude will build the first version.</p>
      <Link href="/dashboard/new" className="btn-primary mt-6 rounded-xl px-4 py-2 text-[14px] font-bold">
        Start a new app
      </Link>
    </div>
  );
}
