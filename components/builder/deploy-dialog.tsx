"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusDot } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  ok: boolean;
}

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; current: boolean }
  | { state: "bad"; reason: string };

/** Mirrors the server's slug rules for instant feedback; the server re-checks before deploying. */
function sanitize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48);
}

export function DeployDialog({
  open,
  onOpenChange,
  projectId,
  name,
  slug,
  domainSuffix,
  deployed,
  busy,
  locked,
  onDeployed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  name: string;
  slug: string;
  domainSuffix: string;
  deployed: boolean;
  busy: boolean;
  /** Set when the URL can no longer change (token launched). */
  locked?: string | null;
  onDeployed: (r: { url: string | null; live: boolean; slug: string; slugChanged: boolean }) => void;
}) {
  const [state, setState] = useState<"idle" | "deploying" | "done" | "failed">("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [draft, setDraft] = useState(slug);
  const [avail, setAvail] = useState<Availability>({ state: "idle" });

  useEffect(() => {
    if (open) {
      setDraft(slug);
      setAvail({ state: "ok", current: true });
    }
  }, [open, slug]);

  // Debounced availability check against the server.
  useEffect(() => {
    if (!open) return;
    if (draft === slug) {
      setAvail({ state: "ok", current: true });
      return;
    }
    if (!draft) {
      setAvail({ state: "bad", reason: "Enter a name." });
      return;
    }
    setAvail({ state: "checking" });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/slug?slug=${encodeURIComponent(draft)}`, { signal: ctrl.signal });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Could not check this name.");
        setAvail(d.available ? { state: "ok", current: !!d.current } : { state: "bad", reason: d.reason });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setAvail({ state: "bad", reason: (err as Error).message });
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [draft, slug, open, projectId]);

  const changing = draft !== slug;
  const canDeploy = !busy && avail.state === "ok" && state !== "deploying";

  async function deploy() {
    setState("deploying");
    setError(null);
    setSteps([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changing ? { slug: draft } : {}),
      });
      const data = await res.json().catch(() => ({}));
      setSteps(data.steps ?? []);
      if (data.slug) onDeployed({ url: data.url ?? null, live: !!data.ok, slug: data.slug, slugChanged: !!data.slugChanged });
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Deployment failed.");
      setUrl(data.url);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed.");
      setState("failed");
    }
  }

  async function stop() {
    setStopping(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/stop`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not stop deployment.");
      toast.success("Deployment stopped");
      onDeployed({ url: null, live: false, slug, slugChanged: false });
      setState("idle");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not stop deployment.");
    } finally {
      setStopping(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (state === "deploying") return;
        if (!o) setState("idle");
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deploy {name}</DialogTitle>
          <DialogDescription>Publish the current version of your project to its own URL.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="deploy-slug" className="text-[13px] font-medium text-muted">Domain</label>
          <div
            className={cn(
              "flex items-center border font-mono text-[14px] transition-colors focus-within:border-fg/60",
              avail.state === "bad" ? "border-danger/60" : "border-border",
              (locked || state === "deploying") && "opacity-60",
            )}
          >
            <span className="pl-3 text-subtle">https://</span>
            <input
              id="deploy-slug"
              value={draft}
              onChange={(e) => setDraft(sanitize(e.target.value))}
              disabled={!!locked || state === "deploying"}
              spellCheck={false}
              autoComplete="off"
              className="h-10 min-w-0 flex-1 bg-transparent px-0.5 text-fg outline-none"
              aria-describedby="deploy-slug-status"
            />
            <span className="pr-3 text-subtle">.{domainSuffix}</span>
          </div>
          <div id="deploy-slug-status" className="min-h-[20px] text-[13px]" aria-live="polite">
            {locked ? (
              <span className="text-muted">{locked}</span>
            ) : avail.state === "checking" ? (
              <span className="flex items-center gap-1.5 text-muted"><Loader2 className="size-3.5 animate-spin" /> Checking availability…</span>
            ) : avail.state === "bad" ? (
              <span className="flex items-center gap-1.5 text-danger"><X className="size-3.5" /> {avail.reason}</span>
            ) : avail.state === "ok" && changing ? (
              <span className="flex items-center gap-1.5 text-success"><Check className="size-3.5" /> {draft}.{domainSuffix} is available</span>
            ) : (
              <span className="text-subtle">You can change this name before deploying.</span>
            )}
          </div>
          {changing && deployed && avail.state === "ok" && (
            <p className="text-[13px] text-warning">The site moves to the new address; {slug}.{domainSuffix} stops working.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-muted">Status</span>
          <span className="flex items-center gap-1.5">
            <StatusDot tone={deployed ? "success" : busy ? "warning" : "neutral"} /> {deployed ? "Live" : busy ? "Claude is working — deploy when it finishes" : "Ready"}
          </span>
        </div>

        {(state === "deploying" || steps.length > 0) && (
          <div className="space-y-2 text-sm">
            {state === "deploying" && steps.length === 0 && (
              <div className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin text-fg" /> Building and starting your deployment…</div>
            )}
            {steps.map((s) => (
              <div key={s.label} className={s.ok ? "flex items-center gap-2 text-success" : "flex items-center gap-2 text-danger"}>
                {s.ok ? <Check className="size-4" /> : <X className="size-4" />} {s.label}
              </div>
            ))}
          </div>
        )}

        {error && <p className="border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}

        {state === "done" && url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border border-success/25 bg-success/5 px-4 py-3 font-mono text-sm text-success hover:bg-success/10">
            {url} <ExternalLink className="size-4" />
          </a>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {deployed && state !== "deploying" && !changing && (
            <Button variant="danger" onClick={stop} loading={stopping}>Stop</Button>
          )}
          {state === "done" ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <Button variant="accent" onClick={deploy} loading={state === "deploying"} disabled={!canDeploy}>
              {state !== "deploying" && <Rocket />} {changing ? (deployed ? "Move & redeploy" : "Deploy to new URL") : deployed ? "Redeploy" : "Deploy"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
