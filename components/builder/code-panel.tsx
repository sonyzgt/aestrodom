"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { FileCode2, Lock } from "lucide-react";
import { useTheme } from "@/components/theme-toggle";

const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="p-4 text-xs text-subtle">Loading editor…</div>,
});

function languageFor(path: string) {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx") || path.endsWith(".js") || path.endsWith(".mjs")) return "javascript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".svg") || path.endsWith(".xml")) return "xml";
  return "plaintext";
}

/** Read-only code viewer. Users change code by asking Claude; editing is a future "advanced mode". */
export function CodePanel({ projectId, path, version }: { projectId: string; path: string | null; version: number }) {
  const theme = useTheme();
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load file");
        return d.content as string;
      })
      .then((c) => {
        if (!cancelled) {
          setContent(c);
          setError(null);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, path, version]);

  if (!path) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
        <FileCode2 className="size-5 text-subtle" />
        Select a file to view its code.
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3 font-mono text-[12px] text-muted">
        <span className="truncate">{path}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-subtle">
          <Lock className="size-3" /> Read-only
        </span>
      </div>
      {error ? (
        <div className="p-4 text-sm text-danger">{error}</div>
      ) : (
        <div className="min-h-0 flex-1">
          <Monaco
            theme={theme === "light" ? "light" : "vs-dark"}
            path={path}
            language={languageFor(path)}
            value={content}
            options={{
              readOnly: true,
              domReadOnly: true,
              minimap: { enabled: false },
              fontSize: 12.5,
              lineHeight: 20,
              scrollBeyondLastLine: false,
              renderLineHighlight: "none",
              padding: { top: 12 },
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            }}
          />
        </div>
      )}
    </div>
  );
}
