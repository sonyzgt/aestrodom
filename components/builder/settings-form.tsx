"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/misc";

export function GeneralSettingsForm({
  projectId,
  initial,
  slugLocked,
  domainSuffix,
}: {
  projectId: string;
  initial: { name: string; slug: string; description: string; logoUrl: string; listed: boolean };
  slugLocked: string | null;
  domainSuffix: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          logoUrl: values.logoUrl,
          listed: values.listed,
          ...(slugLocked ? {} : { slug: values.slug }),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Could not save settings.");
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 p-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} maxLength={60} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug</Label>
        <div className="flex items-center gap-2">
          <Input
            id="slug"
            value={values.slug}
            onChange={(e) => setValues({ ...values, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
            maxLength={48}
            disabled={!!slugLocked}
            className="font-mono"
          />
          <span className="shrink-0 font-mono text-sm text-subtle">.{domainSuffix}</span>
        </div>
        {slugLocked && <p className="text-xs text-subtle">{slugLocked}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} maxLength={500} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logo">Logo URL</Label>
        <Input id="logo" value={values.logoUrl} onChange={(e) => setValues({ ...values, logoUrl: e.target.value })} placeholder="https://…" maxLength={512} />
        <p className="text-xs text-subtle">Used as the default token logo.</p>
      </div>
      <label className="flex items-start justify-between gap-6 border-t border-border pt-4">
        <span>
          <span className="block text-[13px] font-medium text-fg">Show on Battleground</span>
          <span className="mt-0.5 block text-xs text-subtle">List this project on the public Battleground page while it is deployed.</span>
        </span>
        <Switch checked={values.listed} onCheckedChange={(v) => setValues({ ...values, listed: v })} aria-label="Show on Battleground" />
      </label>
      <Button type="submit" loading={saving}>Save changes</Button>
    </form>
  );
}

export function DangerZone({ projectId, name, hasToken }: { projectId: string; name: string; hasToken: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function del() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not delete project.");
      toast.success("Project deleted");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete project.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <div className="text-sm font-medium">Delete project</div>
        <p className="mt-1 text-xs text-muted">Removes the project, its files and deployments. This cannot be undone.</p>
      </div>
      <Button variant="danger" onClick={() => setOpen(true)}>Delete project</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the project and takes its website offline.
              {hasToken && " The token on Robinhood Chain is on-chain and will continue to exist."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Type <span className="font-mono text-fg">{name}</span> to confirm</Label>
            <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={del} loading={deleting} disabled={confirm !== name}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
