import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import { HopText } from "@/components/motion/hop-text";

export const metadata = { title: "Templates" };

export default function TemplatesPage() {
  const [featured, ...rest] = TEMPLATES;
  return (
    <div>
      <div className="mb-6">
        <div className="text-[12px] shimmer font-medium tracking-[0.02em]">Blueprints</div>
        <HopText as="h1" trigger="load" text="Start from a blueprint" className="mt-1 text-[clamp(1.7rem,3vw,2.3rem)] font-black tracking-[-0.03em]" />
        <p className="mt-1 text-[14px] text-muted">Every blueprint is just a prompt. Tweak it before Claude starts.</p>
      </div>

      <Link
        href={`/dashboard/new?prompt=${encodeURIComponent(featured.prompt)}`}
        className="panel group relative mb-4 grid overflow-hidden rounded-3xl md:grid-cols-[1fr_1.2fr]"
      >
        <div className="grid-squares flex min-h-44 items-center justify-center border-b border-border bg-inset md:border-b-0 md:border-r">
          <span className="text-heading font-[family-name:var(--font-display)] [font-stretch:125%] text-[84px] font-black leading-none tracking-[-0.06em]">01</span>
        </div>
        <div className="p-6 sm:p-8">
          <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Most used</span>
          <div className="mt-4 text-[22px] font-bold tracking-tight">{featured.title}</div>
          <p className="mt-1.5 text-[14px] text-muted">{featured.blurb}</p>
          <p className="mt-4 line-clamp-3 font-mono text-[12px] leading-relaxed text-subtle">{featured.prompt}</p>
          <span className="btn-primary mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-bold">
            Use blueprint <ArrowRight className="size-4" />
          </span>
        </div>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rest.map((t, i) => (
          <Link
            key={t.id}
            href={`/dashboard/new?prompt=${encodeURIComponent(t.prompt)}`}
            className="panel group flex flex-col rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] text-subtle">{String(i + 2).padStart(2, "0")}</span>
              <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
            </div>
            <div className="mt-6 text-[17px] font-semibold tracking-tight">{t.title}</div>
            <p className="mt-1 text-[13px] text-muted">{t.blurb}</p>
            <p className="mt-4 line-clamp-2 rounded-lg border border-border bg-inset px-3 py-2 font-mono text-[11.5px] leading-relaxed text-subtle">{t.prompt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
