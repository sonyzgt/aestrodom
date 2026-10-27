"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Check, CircleDashed, Hammer, Loader2, X } from "lucide-react";
import type { ChatMessage } from "./types";
import { cn } from "@/lib/utils";

export function ChatPanel({ messages }: { messages: ChatMessage[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted">Ask Claude to change anything.</p>
        <p className="mt-1 text-xs text-subtle">“Make the hero more cinematic” · “Add a roadmap section”</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5">
      {messages.map((m) => (m.role === "USER" ? <UserBubble key={m.id} text={m.content} /> : <AgentMessage key={m.id} m={m} />))}
      <div ref={end} />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] whitespace-pre-wrap rounded-sm bg-elevated px-3.5 py-2.5 text-[13.5px] leading-relaxed text-fg">{text}</div>
    </div>
  );
}

function AgentMessage({ m }: { m: ChatMessage }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
        <span className="relative flex size-1.5">
          {m.pending && <span className="absolute inline-flex size-full animate-ping rounded-full bg-fg opacity-60" />}
          <span className="relative inline-flex size-1.5 rounded-full bg-fg" />
        </span>
        Claude
      </div>
      {m.activity && m.activity.length > 0 && (
        <div className="space-y-1 border border-border bg-inset p-2.5">
          {m.activity.slice(-12).map((a) => (
            <div key={a.id} className="flex items-center gap-2 font-mono text-[11.5px] text-muted">
              {a.status === "running" ? (
                <Loader2 className="size-3 animate-spin text-fg" />
              ) : a.status === "done" ? (
                <Check className="size-3 text-success" />
              ) : (
                <X className="size-3 text-danger" />
              )}
              <span className="truncate">{a.label}</span>
            </div>
          ))}
          {m.activity.length > 12 && <div className="pl-5 font-mono text-[11px] text-subtle">+{m.activity.length - 12} earlier steps</div>}
        </div>
      )}
      {m.build && (
        <div
          className={cn(
            "flex items-center gap-2 text-xs",
            m.build.status === "ok" ? "text-success" : m.build.status === "failed" ? "text-warning" : m.build.status === "unavailable" ? "text-subtle" : "text-muted",
          )}
        >
          {m.build.status === "running" ? <Loader2 className="size-3.5 animate-spin" /> : m.build.status === "ok" ? <Check className="size-3.5" /> : <Hammer className="size-3.5" />}
          {m.build.status === "running" && "Building application…"}
          {m.build.status === "ok" && "Build successful — preview updated"}
          {m.build.status === "failed" && "Build failed — Claude is fixing it"}
          {m.build.status === "unavailable" && "Preview runtime unavailable — files saved"}
        </div>
      )}
      {m.content ? (
        <div className={cn("whitespace-pre-wrap text-[13.5px] leading-relaxed", m.error ? "flex items-start gap-2 text-danger" : "text-fg/90")}>
          {m.error && <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          {m.content}
        </div>
      ) : m.pending ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <CircleDashed className="size-3.5 animate-spin" /> {m.status || "Claude is thinking"}
        </div>
      ) : null}
    </div>
  );
}
