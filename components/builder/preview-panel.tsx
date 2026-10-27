"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Monitor, MonitorPlay, RotateCw, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEVICES = {
  desktop: { icon: Monitor, width: "100%" },
  tablet: { icon: Tablet, width: "820px" },
  mobile: { icon: Smartphone, width: "390px" },
} as const;

export function PreviewPanel({
  url,
  version,
  busy,
  onStart,
  starting,
}: {
  url: string | null;
  version: number;
  busy: boolean;
  onStart: () => void;
  starting: boolean;
}) {
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop");
  const [reload, setReload] = useState(0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex items-center gap-0.5">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => {
            const Icon = DEVICES[d].icon;
            return (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={cn("rounded-md p-1.5 transition-colors", device === d ? "bg-elevated text-fg" : "text-subtle hover:text-fg")}
                aria-label={`${d} preview`}
              >
                <Icon className="size-3.5" />
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex max-w-xs items-center gap-2 truncate rounded-md border border-border bg-bg px-2.5 py-1 font-mono text-[11px] text-muted">
            {busy && <Loader2 className="size-3 animate-spin text-fg" />}
            <span className="truncate">{url ?? "preview not started"}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setReload((r) => r + 1)} className="rounded-md p-1.5 text-subtle hover:text-fg" aria-label="Reload preview" disabled={!url}>
            <RotateCw className="size-3.5" />
          </button>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-subtle hover:text-fg" aria-label="Open preview in new tab">
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>
      <div className="relative flex flex-1 justify-center overflow-auto bg-inset p-0 md:p-3">
        {url ? (
          <iframe
            key={`${url}-${version}-${reload}`}
            src={url}
            title="Live preview"
            // No allow-same-origin: preview code runs in an opaque origin and cannot reach Aestrodom.
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            referrerPolicy="no-referrer"
            className="h-full rounded-none border-0 bg-white transition-[width] duration-300 md:rounded-lg md:border md:border-border"
            style={{ width: DEVICES[device].width, maxWidth: "100%" }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            {busy ? (
              <>
                <Loader2 className="size-5 animate-spin text-fg" />
                <p className="text-sm text-muted">Claude is building your application…</p>
              </>
            ) : (
              <>
                <MonitorPlay className="size-6 text-subtle" />
                <p className="text-sm text-muted">The preview is not running.</p>
                <Button size="sm" variant="secondary" onClick={onStart} loading={starting}>Start preview</Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
