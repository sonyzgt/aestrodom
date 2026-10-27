import Link from "next/link";
import { Plus } from "lucide-react";
import { currentUserOrRedirect } from "@/lib/session";
import { EmptyProjects, ProjectRows, STATUS_FILTERS, loadProjects, type StatusFilter } from "@/components/dashboard/project-list";
import { cn } from "@/lib/utils";
import { HopText } from "@/components/motion/hop-text";

export const metadata = { title: "Projects" };

const LABELS: Record<StatusFilter, string> = { all: "All", live: "Live", draft: "Drafts", error: "Errors" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await currentUserOrRedirect();
  const { status } = await searchParams;
  const filter = STATUS_FILTERS.find((f) => f === status) ?? "all";
  const projects = await loadProjects(user.id, { filter });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12px] shimmer font-medium tracking-[0.02em]">Library</div>
          <HopText as="h1" trigger="load" text="All apps" className="mt-1 text-[clamp(1.7rem,3vw,2.3rem)] font-black tracking-[-0.03em]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-xl border border-border bg-inset p-1">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f}
                href={f === "all" ? "/dashboard/projects" : `/dashboard/projects?status=${f}`}
                className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", f === filter ? "btn-primary" : "text-muted hover:text-fg")}
              >
                {LABELS[f]}
              </Link>
            ))}
          </div>
          <Link href="/dashboard/new" className="btn-primary grid size-10 place-items-center rounded-xl" aria-label="New app">
            <Plus className="size-4" />
          </Link>
        </div>
      </div>
      {projects.length ? <ProjectRows projects={projects} /> : <EmptyProjects message={filter === "all" ? "No apps yet." : `No ${LABELS[filter].toLowerCase()} right now.`} />}
    </div>
  );
}
