import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Builder, type ChatItem } from "../builder";
import { ArrowLogo, ArrowSite, SITE_WIDTH, type SiteState } from "../site";
import { BrandMark, Button, C, Caption, Caret, Check, Cursor, Grid, Label, Sfx, Spinner, TypingSound, Window, display, ease, pressAt, rise, sans, typed } from "../ui";

/** Every product scene shows one browser window at the same spot under its caption. */
const WX = 120;
const WY = 210;
/** Top-left of the window's content area in composition pixels (below the 52px address bar). */
const BX = WX;
const BY = WY + 52;

const PROMPT = "Build a crypto landing page called Arrow with a black background, purple accents, an animated hero, feature cards, tokenomics and a roadmap.";
const EDIT = "Make the hero more cinematic";

const BUILT: SiteState = { hero: 1, features: 1, tokenomics: 1, roadmap: 1, cinematic: 0 };

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: sans, color: C.ink }}>
      <Grid opacity={0.7} />
      {children}
    </AbsoluteFill>
  );
}

/** The window slides up into place over the first frames of a scene. */
function enter(frame: number): React.CSSProperties {
  return { left: WX, top: WY + ease(frame, [0, 22], [40, 0]), opacity: ease(frame, [0, 14], [0, 1]) };
}

/* ------------------------------------------------------------------ */
/* 01 Describe it                                                      */
/* ------------------------------------------------------------------ */

export function Prompt() {
  const frame = useCurrentFrame();
  const text = typed(PROMPT, frame, 22, 40);
  const name = typed("Arrow", frame, 150, 14);
  const go = pressAt(frame, 182);
  return (
    <Stage>
      <Caption step="01" title="Describe it" sub="One sentence is enough to start." />
      <TypingSound text={PROMPT} start={22} cps={40} />
      <TypingSound text="Arrow" start={150} cps={14} />
      <Window url="aestrodom.org/dashboard/new" style={enter(frame)}>
        <AppBar active="Home" />
        <div style={{ width: 960, margin: "70px auto 0" }}>
          <Label>New project</Label>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 38, letterSpacing: "0.08em", marginTop: 12, textTransform: "uppercase" }}>What do you want to build?</div>
          <div style={{ marginTop: 26, height: 170, borderRadius: 10, border: `1.5px solid ${frame > 18 && frame < 145 ? C.ink : C.line}`, padding: "18px 20px", fontSize: 22, lineHeight: 1.5 }}>
            {text || <span style={{ color: C.faint }}>A booking page for my pottery studio…</span>}
            {frame > 18 && frame < 145 && <Caret />}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            {["Portfolio for a photographer", "Coffee shop menu", "Meme coin landing page", "Habit tracker"].map((s) => (
              <div key={s} style={{ padding: "7px 13px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>
                {s}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 30 }}>
            <div style={{ flex: 1 }}>
              <Label>Project name</Label>
              <div style={{ marginTop: 10, height: 54, borderRadius: 10, border: `1.5px solid ${frame >= 146 && frame < 172 ? C.ink : C.line}`, padding: "0 18px", display: "flex", alignItems: "center", fontSize: 20 }}>
                {name}
                {frame >= 146 && frame < 172 && <Caret />}
              </div>
            </div>
            <Button pressed={go} style={{ height: 54, width: 230 }}>
              {frame >= 185 ? <Spinner size={18} /> : null}
              Generate →
            </Button>
          </div>
        </div>
      </Window>
      <Cursor
        start={120}
        points={[
          [120, 1500, 980],
          [140, 900, 803],
          [168, 900, 803],
          [180, 1450, 803],
        ]}
        clicks={[142, 182]}
      />
    </Stage>
  );
}

/** Workspace header of the dashboard pages. */
function AppBar({ active }: { active: string }) {
  return (
    <div style={{ height: 64, display: "flex", alignItems: "center", gap: 30, padding: "0 28px", borderBottom: `1px solid ${C.line}` }}>
      <BrandMark size={24} />
      <span style={{ fontFamily: display, fontWeight: 900, fontSize: 16, letterSpacing: "0.15em", marginLeft: -16 }}>AESTRODOM</span>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 36 }}>
        {["Home", "Projects", "Templates", "Battleground"].map((n) => (
          <span key={n} style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: n === active ? C.ink : C.subtle, borderBottom: `1px solid ${n === active ? C.ink : "transparent"}`, paddingBottom: 4 }}>
            {n}
          </span>
        ))}
      </div>
      <div style={{ width: 34, height: 34, borderRadius: 6, background: C.ink, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>A</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 Claude builds it                                                 */
/* ------------------------------------------------------------------ */

const BUILD_CHAT: ChatItem[] = [
  { kind: "user", text: PROMPT, at: 0 },
  { kind: "note", text: "On it. Arrow will be a single-page React app with four sections.", at: 12 },
  { kind: "step", text: "src/components/Hero.tsx", at: 30, done: 62, mono: true },
  { kind: "step", text: "src/components/Features.tsx", at: 64, done: 94, mono: true },
  { kind: "step", text: "src/components/Tokenomics.tsx", at: 96, done: 124, mono: true },
  { kind: "step", text: "src/components/Roadmap.tsx", at: 126, done: 154, mono: true },
  { kind: "step", text: "Type-check & bundle in sandbox", at: 156, done: 200 },
  { kind: "note", text: "Build verified. Your preview is live.", at: 206 },
];

export function Build() {
  const frame = useCurrentFrame();
  const site: SiteState = {
    hero: ease(frame, [48, 70], [0, 1]),
    features: ease(frame, [82, 102], [0, 1]),
    tokenomics: ease(frame, [112, 132], [0, 1]),
    roadmap: ease(frame, [142, 162], [0, 1]),
    cinematic: 0,
  };
  const scroll = interpolate(frame, [100, 130, 150, 175, 215, 245], [0, 420, 420, 900, 900, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Stage>
      <Caption step="02" title="Claude builds it" sub="Relevant files only, precise edits, a verified build." />
      {BUILD_CHAT.map((m) => (m.kind === "step" ? <Sfx key={m.text} at={m.done} name="tick" volume={0.5} /> : null))}
      <Sfx at={200} name="chime" volume={0.55} />
      <Window url="aestrodom.org/project/arrow" style={enter(frame)}>
        <Builder status={frame < 200 ? "building" : "ready"} chat={BUILD_CHAT} site={site} scroll={scroll} />
      </Window>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Talk, don't code                                                 */
/* ------------------------------------------------------------------ */

const EDIT_CHAT: ChatItem[] = [
  { kind: "step", text: "Type-check & bundle in sandbox", at: -1, done: -1 },
  { kind: "note", text: "Build verified. Your preview is live.", at: -1 },
  { kind: "user", text: EDIT, at: 62 },
  { kind: "step", text: "src/components/Hero.tsx", at: 72, done: 104, mono: true },
  { kind: "step", text: "Verified build", at: 106, done: 124 },
];

/** The chat as the edit scene leaves it, shown statically behind the deploy dialog. */
const AFTER_EDIT: ChatItem[] = [
  { kind: "user", text: EDIT, at: -1 },
  { kind: "step", text: "src/components/Hero.tsx", at: -1, done: -1, mono: true },
  { kind: "step", text: "Verified build", at: -1, done: -1 },
];

export function Edit() {
  const frame = useCurrentFrame();
  const typing = frame >= 14 && frame < 60;
  return (
    <Stage>
      <Caption step="03" title="Talk, don't code" sub="Ask for changes in plain words. The rest of your app stays put." />
      <TypingSound text={EDIT} start={14} cps={30} />
      <Sfx at={104} name="tick" volume={0.5} />
      <Sfx at={110} name="swell" volume={0.35} />
      <Sfx at={124} name="tick" volume={0.5} />
      <Window url="aestrodom.org/project/arrow" style={{ left: WX, top: WY }}>
        <Builder
          status={frame >= 72 && frame < 124 ? "building" : "ready"}
          chat={EDIT_CHAT}
          input={frame < 60 ? typed(EDIT, frame, 14, 30) : ""}
          inputFocus={typing}
          site={{ ...BUILT, cinematic: ease(frame, [104, 132], [0, 1]) }}
        />
      </Window>
      <Cursor
        points={[
          [0, 700, 700],
          [10, 360, BY + 680],
          [56, 360, BY + 680],
        ]}
        clicks={[11, 58]}
      />
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Live on its own domain                                           */
/* ------------------------------------------------------------------ */

export function Deploy() {
  const frame = useCurrentFrame();
  const open = ease(frame, [24, 36], [0, 1]);
  const steps: [string, number, number][] = [
    ["Building production image", 40, 62],
    ["Starting isolated container", 62, 80],
    ["Issuing HTTPS certificate", 80, 100],
  ];
  const live = frame >= 102;
  const site = ease(frame, [122, 146], [0, 1]);
  return (
    <Stage>
      <Caption step="04" title="Live on its own domain" sub="HTTPS on demand. Redeploys never take the live version down." />
      {steps.map(([t, , d]) => (
        <Sfx key={t} at={d} name="tick" volume={0.5} />
      ))}
      <Sfx at={102} name="chime" volume={0.55} />
      <Sfx at={118} name="whoosh" volume={0.45} />
      <Window url="aestrodom.org/project/arrow" style={{ left: WX, top: WY }}>
        <Builder status={live ? "live" : "ready"} chat={AFTER_EDIT} site={{ ...BUILT, cinematic: 1 }} highlight={frame < 30 ? "deploy" : undefined} />
        <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${0.25 * open})` }} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 640,
            transform: `translate(-50%, -50%) translateY(${(1 - open) * 30}px)`,
            opacity: open,
            background: C.bg,
            borderRadius: 14,
            border: `1px solid ${C.line}`,
            boxShadow: "0 30px 60px -20px rgba(0,0,0,0.35)",
            padding: 36,
          }}
        >
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: "0.1em" }}>DEPLOY ARROW</div>
          <Label style={{ marginTop: 26 }}>Address</Label>
          <div style={{ marginTop: 10, height: 54, display: "flex", alignItems: "center", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 20, overflow: "hidden" }}>
            <span style={{ padding: "0 4px 0 18px", fontWeight: 600 }}>arrow</span>
            <span style={{ color: C.subtle }}>.aestrodom.org</span>
          </div>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map(([t, a, d]) =>
              frame >= a ? (
                <div key={t} style={{ ...rise(frame, a, 8, 8), display: "flex", alignItems: "center", gap: 12, fontSize: 18, color: frame >= d ? C.ink : C.muted }}>
                  {frame >= d ? <Check /> : <Spinner />}
                  {t}
                </div>
              ) : null,
            )}
          </div>
          {live && (
            <div style={{ ...rise(frame, 102, 10, 10), marginTop: 26, padding: "16px 18px", borderRadius: 10, background: C.soft, display: "flex", alignItems: "center", gap: 12, fontSize: 19 }}>
              <span style={{ width: 11, height: 11, borderRadius: 6, background: C.success }} />
              Live at <b>https://arrow.aestrodom.org</b>
            </div>
          )}
        </div>
      </Window>

      {/* Then the real thing: the deployed site in its own tab. */}
      {site > 0 && (
        <Window url="arrow.aestrodom.org" style={{ left: WX, top: WY, opacity: site, transform: `scale(${0.94 + site * 0.06})` }}>
          <div style={{ transform: `scale(${1678 / SITE_WIDTH})`, transformOrigin: "0 0" }}>
            <ArrowSite s={{ ...BUILT, cinematic: 1 }} frame={frame} />
          </div>
        </Window>
      )}
      <Cursor
        points={[
          [0, 1200, 600],
          [18, 1525, BY + 30],
          [40, 1525, BY + 30],
        ]}
        clicks={[20]}
      />
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Launch its token                                                 */
/* ------------------------------------------------------------------ */

export function Token() {
  const frame = useCurrentFrame();
  const open = ease(frame, [8, 20], [0, 1]);
  const wallet = ease(frame, [84, 96], [0, 1]) * (1 - ease(frame, [118, 126], [0, 1]));
  const sym = typed("ARROW", frame, 22, 16);
  const tax = frame >= 50 ? 1 : 0;
  const progress: [string, number][] = [
    ["Simulated against the factory", 126],
    ["Signed in your wallet", 140],
    ["TokenLaunched read from the receipt", 158],
  ];
  const launched = frame >= 176;
  // Dialog content origin in composition pixels, for the cursor.
  const DX = WX + (1680 - 800) / 2;
  return (
    <Stage>
      <Caption step="05" title="Launch its token" sub="Pons V2 on Robinhood Chain. Your wallet signs, never ours." />
      <TypingSound text="ARROW" start={22} cps={16} />
      <Sfx at={84} name="pop" volume={0.5} />
      {progress.map(([t, at]) => (
        <Sfx key={t} at={at} name="tick" volume={0.5} />
      ))}
      <Sfx at={176} name="chime" volume={0.65} />
      <Window url="aestrodom.org/project/arrow" style={{ left: WX, top: WY }}>
        <Builder status="live" chat={[{ kind: "note", text: "Deployed to arrow.aestrodom.org.", at: -1 }]} site={{ ...BUILT, cinematic: 1 }} highlight={frame < 10 ? "token" : undefined} />
        <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${0.25 * open})` }} />
        <div
          style={{
            position: "absolute",
            left: (1680 - 800) / 2,
            top: 40,
            width: 800,
            opacity: open,
            transform: `translateY(${(1 - open) * 30}px)`,
            background: C.bg,
            borderRadius: 14,
            border: `1px solid ${C.line}`,
            boxShadow: "0 30px 60px -20px rgba(0,0,0,0.35)",
            padding: "30px 36px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: "0.1em" }}>LAUNCH TOKEN</div>
            <Label>Pons V2 · Robinhood Chain</Label>
          </div>
          <div style={{ display: "flex", gap: 22, marginTop: 24, alignItems: "flex-end" }}>
            <ArrowLogo size={84} />
            <Field label="Name" value="Arrow" />
            <Field label="Symbol" value={sym} focus={frame >= 20 && frame < 44} />
          </div>
          <Label style={{ marginTop: 22 }}>Creator tax</Label>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {["1%", "2%", "3%", "4%"].map((t, i) => (
              <div key={t} style={{ width: 80, height: 42, display: "grid", placeItems: "center", borderRadius: 8, fontSize: 17, fontWeight: 600, border: `1px solid ${i === tax ? C.ink : C.line}`, background: i === tax ? C.ink : C.bg, color: i === tax ? "#fff" : C.ink }}>
                {t}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, fontSize: 13, fontWeight: 600, letterSpacing: "0.18em" }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: C.ink }} /> LIVE FROM CHAIN
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginTop: 10, borderTop: `1px solid ${C.line}`, borderLeft: `1px solid ${C.line}` }}>
            {[
              ["Launch fee", "0.0005 ETH"],
              ["Curve fee", "1%"],
              ["Supply", "1B"],
              ["Graduation", "4.2 ETH"],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: "12px 14px", borderRight: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
                <Label style={{ fontSize: 11 }}>{k}</Label>
                <div style={{ fontWeight: 700, fontSize: 19, marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>

          {frame < 124 ? (
            <Button pressed={pressAt(frame, 76)} style={{ width: "100%", marginTop: 24 }}>
              Sign &amp; launch
            </Button>
          ) : (
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              {progress.map(([t, at]) =>
                frame >= at - 14 ? (
                  <div key={t} style={{ ...rise(frame, at - 14, 8, 8), display: "flex", alignItems: "center", gap: 12, fontSize: 18, color: frame >= at ? C.ink : C.muted }}>
                    {frame >= at ? <Check /> : <Spinner />}
                    {t}
                  </div>
                ) : null,
              )}
            </div>
          )}
          {launched && (
            <div style={{ ...rise(frame, 176, 10, 12), marginTop: 18, padding: "16px 18px", borderRadius: 10, background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 19 }}>
              <span style={{ fontFamily: display, fontWeight: 800, letterSpacing: "0.1em" }}>$ARROW IS LIVE</span>
              <span style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 16, opacity: 0.8 }}>0x7a3f…c41e ↗</span>
            </div>
          )}
        </div>

        {/* Wallet confirmation */}
        <div
          style={{
            position: "absolute",
            right: 70,
            top: 120,
            width: 340,
            opacity: wallet,
            transform: `translateY(${(1 - wallet) * 20}px)`,
            background: C.bg,
            borderRadius: 14,
            border: `1px solid ${C.line}`,
            boxShadow: "0 30px 60px -16px rgba(0,0,0,0.4)",
            padding: 24,
          }}
        >
          <Label>Wallet</Label>
          <div style={{ fontWeight: 700, fontSize: 22, marginTop: 8 }}>Confirm transaction</div>
          {[
            ["Function", "launchToken(params)"],
            ["Value", "0.0005 ETH"],
            ["Network", "Robinhood Chain"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 15 }}>
              <span style={{ color: C.subtle }}>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <Button pressed={pressAt(frame, 112)} style={{ width: "100%", marginTop: 22, height: 46, fontSize: 15 }}>
            Confirm
          </Button>
        </div>
      </Window>
      <Cursor
        points={[
          [0, 1300, 700],
          [18, DX + 520, BY + 180],
          [40, DX + 520, BY + 180],
          [48, DX + 165, BY + 290],
          [66, DX + 165, BY + 290],
          [74, DX + 400, BY + 520],
          [96, DX + 400, BY + 520],
          [110, WX + 1680 - 70 - 170, BY + 345],
          [140, WX + 1680 - 70 - 170, BY + 345],
        ]}
        clicks={[20, 50, 76, 112]}
      />
    </Stage>
  );
}

function Field({ label, value, focus }: { label: string; value: string; focus?: boolean }) {
  return (
    <div style={{ flex: 1 }}>
      <Label>{label}</Label>
      <div style={{ marginTop: 10, height: 54, borderRadius: 10, border: `1.5px solid ${focus ? C.ink : C.line}`, padding: "0 18px", display: "flex", alignItems: "center", fontSize: 20, fontWeight: 600 }}>
        {value}
        {focus && <Caret />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 Battleground                                                     */
/* ------------------------------------------------------------------ */

export function Battleground() {
  const frame = useCurrentFrame();
  const arrow = interpolate(frame, [16, 110], [0.21, 0.68], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const climb = ease(frame, [62, 96], [0, 1]);
  const ROW = 100;
  // Arrow overtakes Sprout, then Nebula: it moves from row 3 to row 1 while they each drop one.
  const rows: { name: string; sym: string; p: number; y: number; me?: boolean; hue: string }[] = [
    { name: "Moonpaws", sym: "PAWS", p: 0.82, y: 0, hue: "#f59e0b" },
    { name: "Nebula", sym: "NEB", p: 0.55, y: 1 + climb, hue: "#0ea5e9" },
    { name: "Sprout", sym: "SPRT", p: 0.41, y: 2 + climb, hue: "#22c55e" },
    { name: "Arrow", sym: "ARROW", p: arrow, y: 3 - climb * 2, me: true, hue: "#8b5cf6" },
    { name: "Pixel Duel", sym: "DUEL", p: 0.12, y: 4, hue: "#ef4444" },
  ];
  return (
    <Stage>
      <Caption step="06" title="Enter the Battleground" sub="Every live app, ranked on-chain by how close its curve is to graduating." />
      <Sfx at={72} name="pop" volume={0.55} />
      <Sfx at={88} name="pop" volume={0.6} />
      <Window url="aestrodom.org/battleground" style={enter(frame)}>
        <div style={{ padding: "40px 64px" }}>
          <div style={{ fontFamily: display, fontWeight: 600, fontSize: 56, letterSpacing: "-0.01em" }}>BATTLEGROUND.</div>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 160px 520px 150px", padding: "26px 20px 12px", borderBottom: `1px solid ${C.line}`, fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", color: C.subtle }}>
            <span>#</span>
            <span>PROJECT</span>
            <span>TOKEN</span>
            <span>BONDING CURVE</span>
            <span style={{ textAlign: "right" }}>RAISED</span>
          </div>
          <div style={{ position: "relative", height: ROW * 5 }}>
            {rows.map((r) => (
              <div
                key={r.sym}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: r.y * ROW,
                  height: ROW,
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 160px 520px 150px",
                  alignItems: "center",
                  padding: "0 20px",
                  borderBottom: `1px solid ${C.line}`,
                  background: r.me ? C.soft : C.bg,
                  boxShadow: r.me ? `inset 4px 0 0 ${C.ink}` : undefined,
                  zIndex: r.me ? 2 : 1,
                  fontSize: 23,
                }}
              >
                <span style={{ fontFamily: display, fontWeight: 700, color: C.subtle }}>{Math.round(r.y) + 1}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 700 }}>
                  {r.me ? <ArrowLogo size={38} /> : <span style={{ width: 38, height: 38, borderRadius: 9, background: r.hue }} />}
                  {r.name}
                  {r.me && <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", padding: "4px 8px", borderRadius: 5, background: C.ink, color: "#fff" }}>NEW</span>}
                </span>
                <span style={{ color: C.muted, fontWeight: 600 }}>${r.sym}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ flex: 1, height: 10, borderRadius: 5, background: C.line, overflow: "hidden" }}>
                    <span style={{ display: "block", width: `${r.p * 100}%`, height: "100%", background: C.ink }} />
                  </span>
                  <span style={{ width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{Math.round(r.p * 100)}%</span>
                </span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{(r.p * 4.2).toFixed(2)} ETH</span>
              </div>
            ))}
          </div>
        </div>
      </Window>
    </Stage>
  );
}
