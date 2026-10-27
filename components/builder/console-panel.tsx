"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LogLine {
  id: string;
  source: "AI" | "BUILD" | "RUNTIME" | "DEPLOY" | "TOKEN";
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  message: string;
  createdAt: string;
}

/** Build, runtime, deployment and token logs. Values are redacted server-side before storage. */
export function ConsolePanel({ projectId, active, version }: { projectId: string; active: boolean; version: number }) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const load = () =>
      fetch(`/api/projects/${projectId}/logs`)
        .then((r) => (r.ok ? r.json() : { logs: [] }))
        .then((d) => !stop && setLogs(d.logs ?? []))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [projectId, active, version]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  return (
    <div className="h-full overflow-auto bg-inset p-4 font-mono text-[12px] leading-relaxed">
      {logs.length === 0 && <div className="text-subtle">No logs yet.</div>}
      {logs.map((l) => (
        <div key={l.id} className="flex gap-3">
          <span className="shrink-0 text-subtle">{new Date(l.createdAt).toLocaleTimeString()}</span>
          <span className="w-16 shrink-0 text-subtle">{l.source.toLowerCase()}</span>
          <span
            className={cn(
              "whitespace-pre-wrap break-words",
              l.level === "SUCCESS" && "text-success",
              l.level === "ERROR" && "text-danger",
              l.level === "WARN" && "text-warning",
              l.level === "INFO" && "text-fg/80",
            )}
          >
            {l.level === "SUCCESS" ? "✓ " : l.level === "ERROR" ? "✕ " : ""}
            {l.message}
          </span>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
