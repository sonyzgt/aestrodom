"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Code2, Coins, Eye, FolderTree, MessageSquare, PanelRightClose, PanelRightOpen, RefreshCw, Rocket, Settings, Terminal } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletProviders } from "@/components/wallet/providers";
import { LaunchDialog } from "@/components/token/launch-dialog";
import { TokenDashboard, useTokenData } from "@/components/token/token-dashboard";
import { cn } from "@/lib/utils";
import { SkillPicker } from "@/components/skill-picker";
import type { SkillId } from "@/lib/skills";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel } from "./preview-panel";
import { CodePanel } from "./code-panel";
import { ConsolePanel } from "./console-panel";
import { FileTree } from "./file-tree";
import { DeployDialog } from "./deploy-dialog";
import { TOOL_LABELS, type AgentEvent, type BuilderProject, type ChatMessage } from "./types";

type View = "preview" | "code" | "console" | "token";
type MobilePane = "chat" | "view" | "files";

export function Builder(props: { project: BuilderProject; initialMessages: ChatMessage[]; deployed: boolean; outdated: boolean; userInitial: string }) {
  return (
    <WalletProviders>
      <BuilderInner {...props} />
    </WalletProviders>
  );
}

function BuilderInner({ project: initial, initialMessages, deployed: initiallyDeployed, outdated: initiallyOutdated, userInitial }: { project: BuilderProject; initialMessages: ChatMessage[]; deployed: boolean; outdated: boolean; userInitial: string }) {
  const [project, setProject] = useState(initial);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [skills, setSkills] = useState<SkillId[]>(initial.skills);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<View>("preview");
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  const [filesOpen, setFilesOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>("src/App.tsx");
  const [version, setVersion] = useState(0);
  const [deployOpen, setDeployOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [deployed, setDeployed] = useState(initiallyDeployed);
  // True when files changed after the live deployment was built, i.e. the live site shows an older version.
  const [outdated, setOutdated] = useState(initiallyDeployed && initiallyOutdated);
  const [redeploying, setRedeploying] = useState(false);
  const deployedRef = useRef(deployed);
  deployedRef.current = deployed;
  const redeployRef = useRef<() => void>(() => undefined);
  const [startingPreview, setStartingPreview] = useState(false);
  const [tokenVersion, setTokenVersion] = useState(0);
  const started = useRef(false);

  const token = useTokenData(project.id, deployed, tokenVersion);
  const hasToken = token?.launch && token.launch.status !== "FAILED";

  const patchAssistant = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const run = useCallback(
    async (body: { prompt: string; skills?: SkillId[] } | { initial: true }, displayPrompt: string) => {
      if (running) return;
      setRunning(true);
      const userId = `u-${Date.now()}`;
      const asstId = `a-${Date.now()}`;
      setMessages((ms) => [
        ...ms,
        { id: userId, role: "USER", content: displayPrompt },
        { id: asstId, role: "ASSISTANT", content: "", activity: [], pending: true, status: "Claude is thinking" },
      ]);
      setProject((p) => ({ ...p, status: "BUILDING" }));
      let text = "";
      let changed = false;
      try {
        const res = await fetch(`/api/projects/${project.id}/ai`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Claude could not complete this change.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: AgentEvent;
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            switch (ev.type) {
              case "status":
                if (ev.message) patchAssistant(asstId, (m) => ({ ...m, status: ev.message }));
                break;
              case "text":
                text += ev.delta;
                break;
              case "tool":
                patchAssistant(asstId, (m) => {
                  const activity = [...(m.activity ?? [])];
                  const i = activity.findIndex((a) => a.id === ev.id);
                  const label = ev.label ?? TOOL_LABELS[ev.name] ?? ev.name;
                  if (i >= 0) activity[i] = { ...activity[i], status: ev.status, label };
                  else activity.push({ id: ev.id, label, status: ev.status });
                  return { ...m, activity };
                });
                if (ev.status === "done" && ["write_file", "edit_file", "delete_file", "rename_file"].includes(ev.name)) {
                  changed = true;
                  setVersion((v) => v + 1);
                }
                break;
              case "build":
                patchAssistant(asstId, (m) => ({ ...m, build: { status: ev.status, attempt: ev.attempt } }));
                break;
              case "preview":
                if (ev.url) setProject((p) => ({ ...p, previewUrl: ev.url }));
                setVersion((v) => v + 1);
                break;
              case "done":
                patchAssistant(asstId, (m) => ({ ...m, pending: false, content: ev.summary }));
                break;
              case "error":
                patchAssistant(asstId, (m) => ({ ...m, pending: false, error: true, content: ev.message }));
                break;
            }
          }
        }
      } catch (err) {
        patchAssistant(asstId, (m) => ({ ...m, pending: false, error: true, content: err instanceof Error ? err.message : "Claude could not complete this change." }));
      } finally {
        patchAssistant(asstId, (m) => (m.pending ? { ...m, pending: false, content: m.content || text.trim() || "Done." } : m));
        setRunning(false);
        setVersion((v) => v + 1);
        if (changed && deployedRef.current) {
          setOutdated(true);
          toast("Your live site still shows the previous version", {
            description: "Redeploy to publish these changes.",
            action: { label: "Redeploy", onClick: () => redeployRef.current() },
            duration: 10_000,
          });
        }
        fetch(`/api/projects/${project.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.project && setProject((p) => ({ ...p, status: d.project.status, previewUrl: d.project.previewUrl ?? p.previewUrl, name: d.project.name })))
          .catch(() => undefined);
      }
    },
    [project.id, running, patchAssistant],
  );

  // First visit after creation: start the initial generation automatically.
  useEffect(() => {
    if (started.current) return;
    if (initial.status === "CREATING" && initialMessages.length === 0) {
      started.current = true;
      run({ initial: true }, initial.description);
    }
  }, [initial.status, initial.description, initialMessages.length, run]);

  function send() {
    const prompt = input.trim();
    if (!prompt || running) return;
    setInput("");
    run({ prompt, skills }, prompt);
    setMobilePane("chat");
  }

  async function startPreview() {
    setStartingPreview(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/preview`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error ?? "Could not start the preview.");
      setProject((p) => ({ ...p, previewUrl: d.url }));
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the preview.");
    } finally {
      setStartingPreview(false);
    }
  }

  function applyDeployed({ url, live, slug, slugChanged }: { url: string | null; live: boolean; slug: string; slugChanged: boolean }) {
    if (live) setOutdated(false);
    setDeployed(live);
    setProject((p) => {
      const suffix = p.domain.slice(p.slug.length + 1);
      return {
        ...p,
        slug,
        domain: `${slug}.${suffix}`,
        deploymentUrl: url,
        status: live ? "DEPLOYED" : "READY",
        // The preview moves with the slug and is rebuilt in the background.
        previewUrl: slugChanged ? null : p.previewUrl,
      };
    });
    setVersion((v) => v + 1);
    if (slugChanged) {
      // Pick up the rebuilt preview once it is ready.
      const poll = setInterval(() => {
        fetch(`/api/projects/${project.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.project?.previewUrl) {
              clearInterval(poll);
              setProject((p) => ({ ...p, previewUrl: d.project.previewUrl }));
              setVersion((v) => v + 1);
            }
          })
          .catch(() => undefined);
      }, 4000);
      setTimeout(() => clearInterval(poll), 120_000);
    }
  }

  /** One-click redeploy of the current files to the same URL. */
  async function redeploy() {
    if (redeploying || running) return;
    setRedeploying(true);
    const id = toast.loading("Redeploying your site…");
    try {
      const res = await fetch(`/api/projects/${project.id}/deploy`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (data.slug) applyDeployed({ url: data.url ?? null, live: !!data.ok, slug: data.slug, slugChanged: !!data.slugChanged });
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Deployment failed.");
      toast.success("Live site updated", {
        id,
        action: data.url ? { label: "Open", onClick: () => window.open(data.url, "_blank", "noopener") } : undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deployment failed.", { id });
    } finally {
      setRedeploying(false);
    }
  }
  redeployRef.current = redeploy;

  const statusTone = running ? "warning" : deployed ? "success" : project.status === "ERROR" ? "danger" : "neutral";
  const statusLabel = running ? "Building" : deployed ? "Published" : project.status === "ERROR" ? "Error" : "Draft";

  const center = (
    <div className="h-full min-h-0">
      {view === "preview" && <PreviewPanel url={project.previewUrl} version={version} busy={running} onStart={startPreview} starting={startingPreview} />}
      {view === "code" && <CodePanel projectId={project.id} path={selectedFile} version={version} />}
      {view === "console" && <ConsolePanel projectId={project.id} active={view === "console"} version={version} />}
      {view === "token" && token?.launch && (
        <div className="h-full overflow-auto p-6">
          <div className="mx-auto max-w-2xl">
            <TokenDashboard launch={token.launch} state={token.state} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-bg">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Link href="/dashboard" className="flex items-center gap-2 pr-1" aria-label="Dashboard">
          <BrandMark />
          <span className="hidden font-[family-name:var(--font-display)] text-[13px] font-black uppercase tracking-[0.15em] sm:inline">aestrodom</span>
        </Link>
        <span className="text-border-strong">/</span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[12.5px] font-semibold uppercase tracking-[0.12em]">{project.name}</span>
          <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex"><StatusDot tone={statusTone} />{statusLabel}</span>
        </div>
        <div className="ml-2 hidden items-center gap-0.5 rounded-lg bg-elevated p-0.5 md:flex">
          <ViewButton active={view === "preview"} onClick={() => setView("preview")} icon={<Eye />} label="Preview" />
          <ViewButton active={view === "code"} onClick={() => setView("code")} icon={<Code2 />} label="Code" />
          <ViewButton active={view === "console"} onClick={() => setView("console")} icon={<Terminal />} label="Console" />
          {hasToken && <ViewButton active={view === "token"} onClick={() => setView("token")} icon={<Coins />} label={`$${token!.launch!.symbol}`} />}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {deployed && (
            <Button
              size="sm"
              variant={outdated ? "accent" : "secondary"}
              onClick={redeploy}
              loading={redeploying}
              disabled={running}
              title={running ? "Wait for Claude to finish" : outdated ? "Publish your latest changes to the live site" : "Rebuild and restart the live site"}
            >
              {!redeploying && <RefreshCw />} <span className="hidden sm:inline">{redeploying ? "Redeploying" : outdated ? "Redeploy changes" : "Redeploy"}</span>
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setDeployOpen(true)} disabled={project.status === "CREATING" || redeploying}>
            <Rocket /> <span className="hidden sm:inline">{deployed ? "Deployed" : "Deploy"}</span>
          </Button>
          {deployed && !hasToken && (
            <Button size="sm" variant="accent" onClick={() => setLaunchOpen(true)}>
              <Coins /> <span className="hidden sm:inline">Launch Token</span>
            </Button>
          )}
          <ThemeToggle className="size-8" />
          <Link href={`/project/${project.id}/settings`} className="rounded-md p-2 text-subtle hover:bg-elevated hover:text-fg" aria-label="Project settings">
            <Settings className="size-4" />
          </Link>
          <div className="flex size-7 items-center justify-center rounded-full border border-border-strong text-[11px] font-semibold text-fg">{userInitial}</div>
        </div>
      </header>

      {/* Mobile pane switcher */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border p-1.5 md:hidden">
        {(["chat", "view", "files"] as MobilePane[]).map((p) => (
          <button
            key={p}
            onClick={() => setMobilePane(p)}
            className={cn("flex-1 rounded-sm px-3 py-1.5 text-xs capitalize", mobilePane === p ? "bg-elevated text-fg" : "text-muted")}
          >
            {p === "view" ? "Preview" : p}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar: conversation + composer */}
        <section className={cn("min-h-0 w-full flex-col border-border md:flex md:w-[380px] md:shrink-0 md:border-r", mobilePane === "chat" ? "flex" : "hidden")}>
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4 text-xs font-medium uppercase tracking-wider text-subtle">
            <MessageSquare className="size-3.5" /> AI Chat
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ChatPanel messages={messages} />
          </div>

          <div className="shrink-0 border-t border-border p-3">
            {project.status === "ERROR" && !project.previewUrl && !running && (
              <div className="mb-2 flex items-center justify-between gap-3 border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">
                The first build didn&apos;t complete.
                <Button size="sm" variant="secondary" onClick={() => run({ initial: true }, initial.description)}>Retry</Button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className={cn("border border-border bg-surface transition-colors focus-within:border-fg/50", running && "opacity-70")}
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={3}
                maxLength={8000}
                placeholder={running ? "Claude is working…" : "Ask Claude to change anything…"}
                className="max-h-48 min-h-[84px] border-0 bg-transparent px-3 py-2.5 text-[14px] focus-visible:ring-0"
                disabled={running}
                aria-label="Message Claude"
              />
              <div className="flex items-center justify-between gap-2 px-2 pb-2">
                <span className="flex min-w-0 items-center gap-2">
                  <SkillPicker value={skills} onChange={setSkills} disabled={running} />
                  <span className="truncate text-[11px] text-subtle max-sm:hidden">Enter to send · Shift+Enter for a new line</span>
                </span>
                <Button type="submit" size="icon-sm" disabled={!input.trim() || running} loading={running} variant="accent" aria-label="Send">
                  {!running && <ArrowUp />}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className={cn("min-h-0 min-w-0 flex-1 flex-col md:flex", mobilePane === "view" ? "flex" : "hidden")}>
          <div className="flex items-center gap-1 border-b border-border p-1.5 md:hidden">
            {(["preview", "code", "console"] as View[]).concat(hasToken ? ["token"] : []).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1 text-xs capitalize", view === v ? "bg-elevated text-fg" : "text-muted")}>{v}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1">{center}</div>
        </section>

        <aside className={cn("min-h-0 flex-col border-l border-border lg:flex", filesOpen ? "lg:w-60" : "lg:w-10", mobilePane === "files" ? "flex w-full" : "hidden")}>
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-2">
            {filesOpen && <span className="flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wider text-subtle"><FolderTree className="size-3.5" /> Files</span>}
            <button onClick={() => setFilesOpen(!filesOpen)} className="hidden rounded-md p-1.5 text-subtle hover:text-fg lg:block" aria-label="Toggle files">
              {filesOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </button>
          </div>
          {(filesOpen || mobilePane === "files") && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FileTree
                projectId={project.id}
                version={version}
                selected={selectedFile}
                onSelect={(p) => {
                  setSelectedFile(p);
                  setView("code");
                  setMobilePane("view");
                }}
              />
            </div>
          )}
        </aside>
      </div>

      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        projectId={project.id}
        name={project.name}
        slug={project.slug}
        domainSuffix={project.domain.slice(project.slug.length + 1)}
        deployed={deployed}
        busy={running}
        locked={hasToken ? "The URL is recorded in your token's metadata and can't be changed." : null}
        onDeployed={applyDeployed}
      />
      {deployed && (
        <LaunchDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          projectId={project.id}
          onLaunched={() => {
            setTokenVersion((v) => v + 1);
            setView("token");
          }}
        />
      )}
    </div>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors [&_svg]:size-3.5",
        active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
