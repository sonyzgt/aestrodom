import React from "react";
import { useCurrentFrame } from "remotion";
import { ArrowSite, SITE_WIDTH, type SiteState } from "./site";
import { BrandMark, C, Caret, Check, Spinner, display, rise, sans } from "./ui";

export type ChatItem =
  | { kind: "user"; text: string; at: number }
  /** A build step: spinner from `at`, check from `done`. */
  | { kind: "step"; text: string; at: number; done: number; mono?: boolean }
  | { kind: "note"; text: string; at: number };

export type Status = "building" | "ready" | "live";

/** Window body is 1680 × 768; the chat column takes CHAT_W and the preview the rest. */
const CHAT_W = 460;
const BAR_H = 60;
const PREVIEW_PAD = 20;
const PREVIEW_W = 1680 - CHAT_W - PREVIEW_PAD * 2;
const SCALE = PREVIEW_W / SITE_WIDTH;

/** The project workspace: top bar, chat with Claude on the left, live preview on the right. */
export function Builder({
  status,
  chat,
  input = "",
  inputFocus = false,
  site,
  scroll = 0,
  highlight,
}: {
  status: Status;
  chat: ChatItem[];
  input?: string;
  inputFocus?: boolean;
  site: SiteState;
  /** How far the preview is scrolled, in site pixels. */
  scroll?: number;
  /** Which top-bar button to emphasise. */
  highlight?: "deploy" | "token";
}) {
  const frame = useCurrentFrame();
  const statusLabel = { building: "Building…", ready: "Build verified", live: "Live" }[status];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontFamily: sans }}>
      <div style={{ height: BAR_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 18, padding: "0 22px", borderBottom: `1px solid ${C.line}` }}>
        <BrandMark size={24} />
        <span style={{ fontFamily: display, fontWeight: 900, fontSize: 15, letterSpacing: "0.15em" }}>AESTRODOM</span>
        <span style={{ width: 1, height: 22, background: C.line }} />
        <span style={{ fontWeight: 700, fontSize: 18 }}>Arrow</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: C.muted }}>
          {status === "building" ? <Spinner size={14} /> : <span style={{ width: 9, height: 9, borderRadius: 5, background: status === "live" ? C.success : C.ink }} />}
          {statusLabel}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <TopButton active={highlight === "deploy"}>{status === "live" ? "Deployed" : "Deploy"}</TopButton>
          <TopButton solid active={highlight === "token"}>
            Launch Token
          </TopButton>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: CHAT_W, flexShrink: 0, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, padding: 22, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", justifyContent: "flex-end" }}>
            {chat
              .filter((m) => frame >= m.at)
              .map((m, i) => (
                <ChatRow key={i} item={m} frame={frame} />
              ))}
          </div>
          <div style={{ margin: 16, marginTop: 0, minHeight: 56, borderRadius: 10, border: `1px solid ${inputFocus ? C.ink : C.line}`, padding: "15px 16px", fontSize: 17, color: input ? C.ink : C.faint }}>
            {input || "Ask Claude to change something…"}
            {inputFocus && <Caret />}
          </div>
        </div>

        <div style={{ flex: 1, background: C.soft, padding: PREVIEW_PAD, minWidth: 0 }}>
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", background: "#07060b", border: `1px solid ${C.line}` }}>
            <div style={{ transform: `translateY(${-scroll * SCALE}px) scale(${SCALE})`, transformOrigin: "0 0" }}>
              <ArrowSite s={site} frame={frame} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopButton({ children, solid, active }: { children: React.ReactNode; solid?: boolean; active?: boolean }) {
  return (
    <div
      style={{
        height: 38,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.06em",
        background: solid ? C.ink : C.bg,
        color: solid ? "#fff" : C.ink,
        border: `1px solid ${solid ? C.ink : C.line}`,
        boxShadow: active ? `0 0 0 4px rgba(0,0,0,0.12)` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function ChatRow({ item, frame }: { item: ChatItem; frame: number }) {
  const style = rise(frame, item.at, 10, 10);
  if (item.kind === "user") {
    return (
      <div style={{ ...style, alignSelf: "flex-end", maxWidth: "88%", padding: "13px 16px", borderRadius: 12, background: C.ink, color: "#fff", fontSize: 16, lineHeight: 1.45 }}>
        {item.text}
      </div>
    );
  }
  if (item.kind === "note") {
    return <div style={{ ...style, fontSize: 16, lineHeight: 1.5, color: C.muted }}>{item.text}</div>;
  }
  const done = frame >= item.done;
  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: done ? C.bg : C.inset, fontSize: 15 }}>
      {done ? <Check size={17} /> : <Spinner size={17} />}
      <span style={{ fontFamily: item.mono ? "ui-monospace, SFMono-Regular, Consolas, monospace" : sans, color: done ? C.ink : C.muted }}>{item.text}</span>
    </div>
  );
}
