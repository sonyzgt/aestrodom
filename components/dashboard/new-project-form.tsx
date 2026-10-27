"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Gamepad2, Image as ImageIcon, LayoutDashboard, Rocket, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SkillPicker } from "@/components/skill-picker";
import type { SkillId } from "@/lib/skills";

const EXAMPLES = [
  { icon: Rocket, label: "Token launch site", prompt: "Build a token launch site called Forge with a dark steel look, an animated hero, feature cards, tokenomics and a roadmap." },
  { icon: LayoutDashboard, label: "Analytics dashboard", prompt: "Build an analytics dashboard with a sidebar, KPI cards, a revenue chart and a customers table." },
  { icon: User, label: "Personal portfolio", prompt: "Build a minimal portfolio for a product designer with a hero, project grid, about section and contact form." },
  { icon: ImageIcon, label: "NFT gallery", prompt: "Build an NFT gallery front-end with featured collections, a filterable grid and an item detail view." },
  { icon: Gamepad2, label: "Game teaser", prompt: "Build a cinematic game teaser page with an animated hero, features, characters and pre-registration." },
];

const MIN_PROMPT = 8;

export function NewProjectForm({ initialPrompt = "" }: { initialPrompt?: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [name, setName] = useState("");
  const [skills, setSkills] = useState<SkillId[]>([]);
  const [loading, setLoading] = useState(false);
  const ready = prompt.trim().length >= MIN_PROMPT;

  async function submit() {
    if (!ready || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), name: name.trim() || undefined, skills }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create the project.");
      router.push(`/project/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the project.");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="panel rounded-3xl p-3">
        <div className="rounded-2xl border border-border bg-inset focus-within:border-border-strong">
          <Textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="What should it do, who is it for, and how should it feel?"
            rows={9}
            maxLength={8000}
            className="border-0 bg-transparent px-5 py-4 text-[16px] leading-relaxed shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-3 border-t border-border py-2 pl-3 pr-5 text-[12px] text-subtle">
            <SkillPicker value={skills} onChange={setSkills} disabled={loading} />
            <span>
              {prompt.length.toLocaleString()} / 8,000<span className="max-sm:hidden"> · Ctrl + Enter to build</span>
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="App name (optional)"
            maxLength={60}
            className="h-12 rounded-xl sm:max-w-xs"
          />
          <Button onClick={submit} loading={loading} disabled={!ready} size="lg" className="h-12 flex-1 rounded-xl text-[15px]">
            Build my app {!loading && <ArrowRight />}
          </Button>
        </div>
      </div>

      <aside className="panel rounded-3xl p-2">
        <div className="px-3 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Need a spark?</div>
        <div className="space-y-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setPrompt(ex.prompt)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors hover:bg-elevated",
                prompt === ex.prompt ? "bg-elevated text-fg" : "text-muted",
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border-strong bg-elevated shadow-[inset_0_1px_0_var(--sheen)]">
                <ex.icon className="size-4 text-fg" />
              </span>
              {ex.label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
