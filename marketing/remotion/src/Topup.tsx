import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { BrandMark, Button, C, Caption, Caret, Check, Corner, Cursor, Grid, Label, Sfx, Spinner, TypingSound, Window, display, ease, pressAt, rise, sans, typed } from "./ui";

/**
 * Tutorial: topping up credits with $AESTRODOM and spending them in the builder and through the API.
 * 16:9, same light look as the product demo. Numbers match the live pricing at the time of writing
 * (1 $AESTRODOM ≈ $0.0000168, $1 = 100 credits, AI runs at Claude's price + 5%).
 */

const SCENES: [React.FC, number][] = [
  [Title, 110],
  [OpenCredits, 150],
  [PickAmount, 180],
  [Pay, 270],
  [BuildWithCredits, 210],
  [CreateKey, 150],
  [CallApi, 280],
  [End, 150],
];
const FADE = 15;
export const TOPUP_DURATION = SCENES.reduce((s, [, d]) => s + d, 0) - FADE * (SCENES.length - 1);

export function Topup() {
  const starts = SCENES.map((_, i) => SCENES.slice(0, i).reduce((s, [, d]) => s + d, 0) - FADE * i);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Html5Audio
        src={staticFile("sfx/music.wav")}
        volume={(f) => 0.38 * interpolate(f, [TOPUP_DURATION - 60, TOPUP_DURATION], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      {starts.slice(1).map((s) => (
        <Sfx key={s} at={s - 4} name="whoosh" volume={0.35} />
      ))}
      <TransitionSeries>
        {SCENES.flatMap(([Scene, frames], i) => [
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
            <Scene />
          </TransitionSeries.Sequence>,
          ...(i < SCENES.length - 1 ? [<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />] : []),
        ])}
      </TransitionSeries>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const WX = 120;
const WY = 210;
/** Content area of the window (below the 52px address bar), in composition pixels. */
const BX = WX;
const BY = WY + 52;
const WIN_W = 1680;
/** The credits page column. */
const COL_W = 1100;
const COL_X = (WIN_W - COL_W) / 2;

const TOKENS_FOR_5 = "297,619.05";
const KEY = "aestro_sk_7Qm2Lx9VtR4pZc8NwK1sHy6Bf3Dg5Je0Ua2X";
const TREASURY = "0x13d4…ef86";

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: sans, color: C.ink }}>
      <Grid opacity={0.7} />
      {children}
    </AbsoluteFill>
  );
}

function enter(frame: number): React.CSSProperties {
  return { left: WX, top: WY + ease(frame, [0, 22], [40, 0]), opacity: ease(frame, [0, 14], [0, 1]) };
}

const NAV = ["Home", "Projects", "Templates", "Battleground", "Credits"];
const NAV_W = 150;
const NAV_X = (WIN_W - NAV_W * NAV.length) / 2;
/** Centre of a nav item in composition pixels. */
const navPoint = (i: number): [number, number] => [BX + NAV_X + NAV_W * i + NAV_W / 2, BY + 32];

function AppBar({ active, credits }: { active: string; credits?: React.ReactNode }) {
  return (
    <div style={{ position: "relative", height: 64, display: "flex", alignItems: "center", padding: "0 28px", borderBottom: `1px solid ${C.line}` }}>
      <BrandMark size={24} />
      <span style={{ fontFamily: display, fontWeight: 900, fontSize: 16, letterSpacing: "0.15em", marginLeft: 10 }}>AESTRODOM</span>
      <div style={{ position: "absolute", left: NAV_X, top: 0, height: 64, display: "flex" }}>
        {NAV.map((n) => (
          <div key={n} style={{ width: NAV_W, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: n === active ? C.ink : C.subtle, borderBottom: `1px solid ${n === active ? C.ink : "transparent"}`, paddingBottom: 4 }}>
              {n}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        {credits}
        <div style={{ width: 34, height: 34, borderRadius: 6, background: C.ink, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>A</div>
      </div>
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ border: `1px solid ${C.line}`, borderRadius: 20, background: C.bg, ...style }}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Credits page, shared by the top-up scenes                           */
/* ------------------------------------------------------------------ */

interface PageState {
  balance: number;
  /** Selected preset ($), or null. */
  selected: number | null;
  /** 0..1: quote box filled in. */
  quote: number;
  payPressed?: number;
  status?: React.ReactNode;
  connected?: boolean;
}

const OPTIONS = [1, 5, 10, 25];
/** Positions inside the content area. */
const TOPUP_Y = 250;
const BTN_Y = TOPUP_Y + 64;
const BTN_W = 96;
const BTN_GAP = 12;
/** The page column starts below the 64px app bar. */
const COL_TOP = 92;
// Click targets in composition pixels, measured from rendered stills.
const optionPoint = (i: number): [number, number] => [BX + COL_X + 28 + i * (BTN_W + BTN_GAP) + BTN_W / 2, 656];
const payPoint: [number, number] = [610, 847];

function CreditsPage({ s }: { s: PageState }) {
  return (
    <div style={{ position: "absolute", left: COL_X, top: COL_TOP, width: COL_W }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: "0.06em", textTransform: "uppercase" }}>Credits &amp; API</div>
        <div style={{ fontSize: 15, color: C.subtle }}>AI runs at Claude&apos;s own price + 5%</div>
      </div>

      <Panel style={{ marginTop: 22, padding: "22px 28px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <Label>Credit balance</Label>
          <div style={{ marginTop: 8, fontSize: 52, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.round(s.balance).toLocaleString("en-US")}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 15, color: C.subtle, lineHeight: 1.6 }}>
          $1 = 100 credits
          <br />
          Paid in $AESTRODOM on Robinhood Chain
        </div>
      </Panel>

      <Panel style={{ position: "absolute", top: TOPUP_Y - 28, left: 0, right: 0, padding: "22px 28px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>Top up</Label>
          {s.connected && <span style={{ fontSize: 14, color: C.subtle, fontFamily: "monospace" }}>0x8a3f…41c2 · 1,250,000 $AESTRODOM</span>}
        </div>
        <div style={{ display: "flex", gap: BTN_GAP, marginTop: 18 }}>
          {OPTIONS.map((o) => (
            <div
              key={o}
              style={{
                width: BTN_W,
                height: 44,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                fontSize: 18,
                fontWeight: 700,
                border: `1.5px solid ${s.selected === o ? C.ink : C.line}`,
                background: s.selected === o ? C.ink : C.bg,
                color: s.selected === o ? "#fff" : C.ink,
              }}
            >
              ${o}
            </div>
          ))}
          <div style={{ width: 150, height: 44, borderRadius: 8, border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 18, color: C.subtle }}>
            $ {s.selected ?? ""}
          </div>
        </div>

        <div style={{ marginTop: 18, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 20px", height: 104, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {s.quote > 0 ? (
            <>
              <div style={{ opacity: s.quote }}>
                <Label>You pay</Label>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>≈ {TOKENS_FOR_5} $AESTRODOM</div>
                <div style={{ marginTop: 4, fontSize: 14, color: C.subtle }}>1 $AESTRODOM ≈ $0.0000168 · live price from the Pons curve</div>
              </div>
              <div style={{ opacity: s.quote, textAlign: "right" }}>
                <Label>You get</Label>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>500 credits</div>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, color: C.subtle }}>
              {s.selected ? <Spinner size={16} /> : null}
              {s.selected ? "Checking the live price…" : "Pick an amount"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 20 }}>
          <Button pressed={s.payPressed ?? 0} style={{ width: 340, height: 54, fontSize: 16, opacity: s.quote > 0 ? 1 : 0.4 }}>
            Pay ${s.selected ?? 5} in $AESTRODOM
          </Button>
          <div style={{ fontSize: 16 }}>{s.status}</div>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

function Title() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", fontFamily: sans, color: C.ink }}>
      <Sfx at={2} name="pop" volume={0.7} />
      <Sfx at={30} name="chime" volume={0.45} />
      <Grid opacity={ease(frame, [0, 30], [0, 1])} />
      <AbsoluteFill style={{ background: "radial-gradient(closest-side, rgba(255,255,255,1), rgba(255,255,255,0))" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BrandMark size={96} style={{ transform: `scale(${mark})`, opacity: mark }} />
        <div style={{ ...rise(frame, 10, 30), marginTop: 34, display: "flex", alignItems: "center", gap: 14, fontSize: 20, fontWeight: 600, letterSpacing: "0.3em", textTransform: "uppercase", color: C.subtle }}>
          <span style={{ width: 40, height: 1, background: C.ink }} />
          Aestrodom guide
          <span style={{ width: 40, height: 1, background: C.ink }} />
        </div>
        <div style={{ ...rise(frame, 18, 30), marginTop: 24, fontFamily: display, fontWeight: 900, fontSize: 84, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.1 }}>
          Top up credits
          <br />
          <span style={{ color: C.faint }}>&amp; use the API</span>
        </div>
        <div style={{ ...rise(frame, 34, 16), marginTop: 30, fontSize: 26, color: C.muted }}>Pay in $AESTRODOM. AI runs at Claude&apos;s own price + 5%.</div>
      </div>
    </AbsoluteFill>
  );
}

/** 01: the Credits tab in the dashboard. */
function OpenCredits() {
  const frame = useCurrentFrame();
  const click = 70;
  const onCredits = frame >= click + 4;
  const [cx, cy] = navPoint(4);
  return (
    <Stage>
      <Caption step="01" title="Open Credits" sub="Sign in at aestrodom.org and open the Credits tab." />
      <Window url={onCredits ? "aestrodom.org/dashboard/billing" : "aestrodom.org/dashboard"} style={enter(frame)}>
        <AppBar active={onCredits ? "Credits" : "Home"} />
        {onCredits ? (
          <div style={{ opacity: ease(frame, [click + 4, click + 16], [0, 1]) }}>
            <CreditsPage s={{ balance: 0, selected: null, quote: 0 }} />
          </div>
        ) : (
          <div style={{ padding: "60px 120px" }}>
            <div style={{ fontSize: 14, color: C.subtle, letterSpacing: "0.1em" }}>Good morning</div>
            <div style={{ marginTop: 10, fontFamily: display, fontWeight: 800, fontSize: 44, letterSpacing: "0.06em", textTransform: "uppercase" }}>What will you build today?</div>
            <div style={{ marginTop: 30, display: "flex", gap: 20 }}>
              {["Apps", "Live", "Tokens", "AI runs today"].map((l, i) => (
                <Panel key={l} style={{ width: 240, padding: 22 }}>
                  <Label>{l}</Label>
                  <div style={{ marginTop: 8, fontSize: 36, fontWeight: 800 }}>{[3, 2, 1, "20/20"][i]}</div>
                </Panel>
              ))}
            </div>
            <div style={{ marginTop: 26, fontSize: 18, color: C.muted }}>Free AI runs used up for today? Credits keep you building.</div>
          </div>
        )}
      </Window>
      <Cursor start={20} points={[[20, 1500, 900], [62, cx, cy], [110, cx, cy]]} clicks={[click]} />
    </Stage>
  );
}

/** 02: choose how many dollars to top up; the live quote fills in. */
function PickAmount() {
  const frame = useCurrentFrame();
  const click = 50;
  const [ox, oy] = optionPoint(1);
  return (
    <Stage>
      <Caption step="02" title="Pick an amount" sub="Choose $1, $5, $10, $25 or type any amount. You see the token price first." />
      <Window url="aestrodom.org/dashboard/billing" style={{ left: WX, top: WY }}>
        <AppBar active="Credits" />
        <CreditsPage s={{ balance: 0, selected: frame >= click ? 5 : null, quote: ease(frame, [click + 30, click + 44], [0, 1]) }} />
      </Window>
      {frame >= click + 44 && <Sfx at={click + 44} name="tick" volume={0.5} />}
      <Callout at={click + 60} x={BX + COL_X + COL_W - 40} y={634} text="Live price: $5 ≈ 297,619 $AESTRODOM" />
      <Cursor start={0} points={[[0, 1300, 700], [42, ox, oy], [120, ox, oy], [170, ox + 300, oy + 140]]} clicks={[click]} />
    </Stage>
  );
}

/** 03: press Pay, confirm the transfer in the wallet, credits arrive. */
function Pay() {
  const frame = useCurrentFrame();
  const press = 34;
  const confirm = 120;
  const mined = 190;
  const walletOpen = frame >= press + 12 && frame < confirm + 8;
  const balance = ease(frame, [mined + 6, mined + 40], [0, 500]);
  const status =
    frame < press + 4 ? null : frame < confirm ? (
      <span style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted }}>
        <Spinner size={16} /> Price locked for 15 min. Confirm in your wallet…
      </span>
    ) : frame < mined ? (
      <span style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted }}>
        <Spinner size={16} /> Waiting for Robinhood Chain to confirm…
      </span>
    ) : (
      <span style={{ display: "flex", alignItems: "center", gap: 10, color: C.success, fontWeight: 700 }}>
        <Check size={18} color={C.success} /> 500 credits added
      </span>
    );
  const modalX = WIN_W / 2 - 240;
  const confirmPoint: [number, number] = [BX + modalX + 480 - 24 - 105, 718];
  return (
    <Stage>
      <Caption step="03" title="Pay with your wallet" sub="The token amount is locked for 15 minutes. Confirm, and credits land in seconds." />
      <Sfx at={mined} name="chime" volume={0.55} />
      <Window url="aestrodom.org/dashboard/billing" style={{ left: WX, top: WY }}>
        <AppBar active="Credits" />
        <CreditsPage s={{ balance, selected: 5, quote: 1, payPressed: pressAt(frame, press), status, connected: true }} />
        {walletOpen && (
          <AbsoluteFill style={{ background: `rgba(0,0,0,${ease(frame, [press + 12, press + 24], [0, 0.35])})` }}>
            <div
              style={{
                position: "absolute",
                left: modalX,
                top: 180 + ease(frame, [press + 12, press + 26], [30, 0]),
                width: 480,
                padding: 24,
                borderRadius: 18,
                background: C.bg,
                boxShadow: "0 30px 80px -20px rgba(0,0,0,.45)",
                opacity: ease(frame, [press + 12, press + 22], [0, 1]),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: C.subtle }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: C.success }} />
                Your wallet · Robinhood Chain
              </div>
              <div style={{ marginTop: 16, fontSize: 22, fontWeight: 800 }}>Confirm transfer</div>
              <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: C.inset, fontSize: 16, lineHeight: 1.9 }}>
                <Row k="Send" v={`${TOKENS_FOR_5} AESTRODOM`} />
                <Row k="To" v={`${TREASURY} (Aestrodom treasury)`} />
                <Row k="Network fee" v="< $0.01" />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                <div style={{ flex: 1, height: 50, borderRadius: 10, border: `1.5px solid ${C.line}`, display: "grid", placeItems: "center", fontWeight: 600 }}>Reject</div>
                <div style={{ flex: 1, height: 50, borderRadius: 10, background: C.ink, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, transform: `scale(${1 - pressAt(frame, confirm) * 0.04})` }}>
                  Confirm
                </div>
              </div>
            </div>
          </AbsoluteFill>
        )}
      </Window>
      <Cursor
        start={0}
        points={[
          [0, payPoint[0] + 200, payPoint[1] + 120],
          [26, payPoint[0], payPoint[1]],
          [60, payPoint[0], payPoint[1]],
          [108, confirmPoint[0], confirmPoint[1]],
          [150, confirmPoint[0] + 160, confirmPoint[1] + 160],
        ]}
        clicks={[press, confirm]}
      />
    </Stage>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
      <span style={{ color: C.subtle }}>{k}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}

/** 04: a builder request spends credits at Claude's price + 5%. */
function BuildWithCredits() {
  const frame = useCurrentFrame();
  const prompt = "Add a dark mode toggle to the header";
  const send = 58;
  const done = 150;
  const steps = [
    ["Read src/components/Header.tsx", send + 18],
    ["Edited src/components/Header.tsx", send + 40],
    ["Created src/hooks/useTheme.ts", send + 62],
    ["Build passed", send + 84],
  ] as const;
  const credits = frame < done ? 500 : Math.round(ease(frame, [done, done + 24], [500, 448]));
  return (
    <Stage>
      <Caption step="04" title="Build with credits" sub="Every AI run costs what Claude charges for it, plus 5%. Nothing hidden." />
      <TypingSound text={prompt} start={8} cps={30} />
      <Sfx at={send} name="click" volume={0.9} />
      {steps.map(([t, at]) => (
        <Sfx key={t} at={at} name="tick" volume={0.45} />
      ))}
      <Sfx at={done} name="pop" volume={0.5} />
      <Window url="aestrodom.org/project/coffee-shop" style={enter(frame)}>
        <AppBar
          active="Projects"
          credits={
            <div style={{ position: "relative", padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${C.ink}`, fontSize: 15, fontWeight: 700 }}>
              {credits} credits
              {frame >= done && (
                <span style={{ position: "absolute", right: 0, top: -30 - ease(frame, [done, done + 40], [0, 18]), fontSize: 18, color: "#dc2626", fontWeight: 800, opacity: ease(frame, [done, done + 8], [0, 1]) * ease(frame, [done + 40, done + 56], [1, 0]) }}>
                  −52
                </span>
              )}
            </div>
          }
        />
        <div style={{ display: "flex", height: 768 - 64 }}>
          <div style={{ width: 620, borderRight: `1px solid ${C.line}`, padding: 28, display: "flex", flexDirection: "column" }}>
            {frame >= send && (
              <div style={{ alignSelf: "flex-end", maxWidth: 480, padding: "12px 16px", borderRadius: 14, background: C.ink, color: "#fff", fontSize: 17 }}>{prompt}</div>
            )}
            <div style={{ marginTop: 20 }}>
              {steps.map(([t, at], i) =>
                frame >= at ? (
                  <div key={t} style={{ ...rise(frame, at, 10, 8), display: "flex", alignItems: "center", gap: 12, padding: "10px 0", fontSize: 16, fontFamily: i < 3 ? "monospace" : sans, fontWeight: i === 3 ? 700 : 400, color: i === 3 ? C.success : C.ink }}>
                    <Check size={16} color={i === 3 ? C.success : C.ink} /> {t}
                  </div>
                ) : null,
              )}
            </div>
            {frame >= done && (
              <div style={{ ...rise(frame, done, 10, 10), marginTop: 18, padding: 16, borderRadius: 12, background: C.inset, fontSize: 15, lineHeight: 1.7 }}>
                <b>This run:</b> Claude cost $0.4924 + 5% = $0.517
                <br />→ 52 credits
              </div>
            )}
            <div style={{ marginTop: "auto", height: 60, borderRadius: 12, border: `1.5px solid ${frame < send ? C.ink : C.line}`, display: "flex", alignItems: "center", padding: "0 18px", fontSize: 17 }}>
              {frame < send ? (
                <>
                  {typed(prompt, frame, 8, 30)}
                  <Caret />
                </>
              ) : (
                <span style={{ color: C.faint }}>Ask for a change…</span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, padding: 30, background: frame >= send + 84 ? "#0b0b0d" : C.inset, transition: "none" }}>
            <div style={{ height: "100%", borderRadius: 14, border: `1px solid ${frame >= send + 84 ? "#27272a" : C.line}`, padding: 28, color: frame >= send + 84 ? "#fff" : C.ink }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 26, letterSpacing: "0.08em" }}>BEAN &amp; CO.</div>
                <div style={{ width: 54, height: 28, borderRadius: 14, background: frame >= send + 84 ? "#fff" : C.line, position: "relative" }}>
                  <div style={{ position: "absolute", top: 3, left: frame >= send + 84 ? 29 : 3, width: 22, height: 22, borderRadius: 11, background: frame >= send + 84 ? "#0b0b0d" : "#fff" }} />
                </div>
              </div>
              <div style={{ marginTop: 70, fontSize: 46, fontWeight: 800, lineHeight: 1.1 }}>Fresh coffee,
                <br />roasted daily.</div>
              <div style={{ marginTop: 18, fontSize: 18, opacity: 0.7 }}>Open every day, 7am to 6pm.</div>
            </div>
          </div>
        </div>
      </Window>
    </Stage>
  );
}

/** 05: create a personal API key; it is shown once. */
function CreateKey() {
  const frame = useCurrentFrame();
  const name = "My bot";
  const create = 50;
  const copy = 104;
  const shown = frame >= create + 6;
  return (
    <Stage>
      <Caption step="05" title="Create an API key" sub="On the same page. The key is shown once: copy it and keep it secret." />
      <TypingSound text={name} start={8} cps={14} />
      <Window url="aestrodom.org/dashboard/billing" style={{ left: WX, top: WY }}>
        <AppBar active="Credits" />
        <div style={{ position: "absolute", left: COL_X, top: COL_TOP + 12, width: COL_W }}>
          <Panel style={{ padding: "26px 28px" }}>
            <Label>API keys</Label>
            <div style={{ marginTop: 10, fontSize: 17, color: C.muted }}>Create apps, run Claude and deploy from your own scripts. Requests made with a key spend credits.</div>
            <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
              <div style={{ flex: 1, height: 52, borderRadius: 10, border: `1.5px solid ${frame < create ? C.ink : C.line}`, display: "flex", alignItems: "center", padding: "0 16px", fontSize: 18 }}>
                {typed(name, frame, 8, 14)}
                {frame < create && <Caret />}
              </div>
              <Button pressed={pressAt(frame, create)} style={{ width: 220, height: 52 }}>
                Create key
              </Button>
            </div>
            {shown && (
              <div style={{ ...rise(frame, create + 6, 14, 12), marginTop: 22, padding: 20, borderRadius: 14, border: `1.5px solid ${C.ink}`, background: C.inset }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Copy your key now. You won&apos;t be able to see it again.</div>
                <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                  <div style={{ flex: 1, height: 48, borderRadius: 10, background: C.bg, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 16px", fontFamily: "monospace", fontSize: 17 }}>{KEY}</div>
                  <div style={{ width: 130, height: 48, borderRadius: 10, border: `1.5px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 700, transform: `scale(${1 - pressAt(frame, copy) * 0.05})` }}>
                    {frame >= copy ? <Check size={16} /> : null}
                    {frame >= copy ? "Copied" : "Copy"}
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderTop: `1px solid ${C.line}`, fontSize: 16, opacity: shown ? 1 : 0 }}>
              <b>My bot</b>
              <span style={{ fontFamily: "monospace", color: C.subtle }}>aestro_sk_7Qm2Lx…</span>
              <span style={{ color: C.subtle }}>Never used</span>
              <span style={{ marginLeft: "auto", color: C.subtle }}>Revoke</span>
            </div>
          </Panel>
        </div>
      </Window>
      <Cursor
        start={0}
        points={[
          [0, 1500, 950],
          [40, 1372, 490],
          [70, 1372, 490],
          [98, 1396, 618],
          [140, 1500, 820],
        ]}
        clicks={[create, copy]}
      />
    </Stage>
  );
}

/** 06: the same flow from a terminal: check the key, create an app, let Claude build it, deploy. */
function CallApi() {
  const frame = useCurrentFrame();
  const lines: { at: number; cmd?: string; out?: string; dim?: boolean }[] = [
    { at: 6, cmd: 'export AESTRODOM_KEY="aestro_sk_7Qm2Lx…"' },
    { at: 34, cmd: 'curl https://aestrodom.org/api/me -H "Authorization: Bearer $AESTRODOM_KEY"' },
    { at: 66, out: '{"plan":"FREE","credits":448,"auth":"api_key"}' },
    { at: 80, cmd: `curl -X POST https://aestrodom.org/api/projects -H "Authorization: Bearer $AESTRODOM_KEY" \\\n     -d '{"prompt":"A landing page for my coffee shop"}'` },
    { at: 120, out: '{"id":"cmv8x2k1p0003kq7w","slug":"coffee-shop"}' },
    { at: 132, cmd: `curl -N -X POST https://aestrodom.org/api/projects/cmv8x2k1p0003kq7w/ai -H "Authorization: Bearer $AESTRODOM_KEY" -d '{"initial":true}'` },
    { at: 164, out: '{"type":"status","message":"Reading your project"}', dim: true },
    { at: 172, out: '{"type":"tool","name":"write_file","status":"done","label":"Created src/App.tsx"}', dim: true },
    { at: 180, out: '{"type":"build","status":"ok","attempt":1}', dim: true },
    { at: 188, out: '{"type":"done","summary":"Built a landing page for Bean & Co.","buildOk":true}' },
    { at: 204, cmd: `curl -X POST https://aestrodom.org/api/projects/cmv8x2k1p0003kq7w/deploy -H "Authorization: Bearer $AESTRODOM_KEY" -d '{}'` },
    { at: 240, out: '{"ok":true,"url":"https://coffee-shop.aestrodom.org", …}' },
  ];
  return (
    <Stage>
      <Caption step="06" title="Use the API" sub="Create, build and deploy apps from your own code. Runs spend the same credits." />
      {lines.map((l) => (l.cmd ? <TypingSound key={l.at} text={l.cmd.slice(0, 40)} start={l.at} cps={60} volume={0.2} /> : <Sfx key={l.at} at={l.at} name="tick" volume={0.3} />))}
      <Sfx at={240} name="chime" volume={0.5} />
      <div
        style={{
          position: "absolute",
          left: WX,
          top: WY + ease(frame, [0, 22], [40, 0]),
          opacity: ease(frame, [0, 14], [0, 1]),
          width: WIN_W,
          height: 820,
          borderRadius: 14,
          background: "#0b0b0d",
          boxShadow: "0 40px 80px -30px rgba(15,23,42,0.4)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: 46, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", background: "#18181b", color: "#a1a1aa", fontSize: 14 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: "#3f3f46" }} />
          ))}
          <span style={{ marginLeft: 14 }}>Terminal</span>
        </div>
        <div style={{ padding: "22px 30px", fontFamily: "ui-monospace, Consolas, monospace", fontSize: 19, lineHeight: 1.6, color: "#e4e4e7", whiteSpace: "pre-wrap" }}>
          {lines.map((l, i) => {
            if (frame < l.at) return null;
            if (l.cmd) {
              const next = lines[i + 1]?.at ?? l.at + 60;
              const cps = Math.max(60, (l.cmd.length * 30) / Math.max(8, next - l.at - 6));
              const t = typed(l.cmd, frame, l.at, cps);
              return (
                <div key={i} style={{ marginTop: i ? 10 : 0 }}>
                  <span style={{ color: "#22c55e" }}>$ </span>
                  {t}
                  {t.length < l.cmd.length && <span style={{ display: "inline-block", width: 10, height: 20, background: "#e4e4e7", verticalAlign: -3 }} />}
                </div>
              );
            }
            return (
              <div key={i} style={{ color: l.dim ? "#71717a" : "#a5f3fc" }}>
                {l.out}
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

function Callout({ at, x, y, text }: { at: number; x: number; y: number; text: string }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div style={{ ...rise(frame, at, 16, 12), position: "absolute", left: x - 520, top: y, width: 520, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ padding: "12px 18px", borderRadius: 12, background: C.ink, color: "#fff", fontSize: 18, fontWeight: 600, boxShadow: "0 16px 30px -12px rgba(0,0,0,.4)" }}>{text}</div>
    </div>
  );
}

function End() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 15 } });
  const steps = ["Open Credits", "Pick an amount", "Pay in $AESTRODOM", "Build or call the API"];
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", fontFamily: sans, color: C.ink }}>
      <Sfx at={2} name="pop" volume={0.6} />
      <Sfx at={40} name="chime" volume={0.5} />
      <Grid />
      <AbsoluteFill style={{ background: "radial-gradient(closest-side, rgba(255,255,255,1) 30%, rgba(255,255,255,0))" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BrandMark size={80} style={{ transform: `scale(${mark})` }} />
        <div style={{ ...rise(frame, 8, 30), marginTop: 28, fontFamily: display, fontWeight: 900, fontSize: 64, letterSpacing: "0.12em" }}>AESTRODOM</div>
        <div style={{ display: "flex", gap: 16, marginTop: 34 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ ...rise(frame, 18 + i * 5, 16), position: "relative", padding: "16px 22px" }}>
              <Corner pos="tl" style={{ position: "absolute", left: 0, top: 0 }} />
              <Corner pos="br" style={{ position: "absolute", right: 0, bottom: 0 }} />
              <div style={{ fontSize: 14, color: C.faint, fontWeight: 700, letterSpacing: "0.2em" }}>0{i + 1}</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700 }}>{s}</div>
            </div>
          ))}
        </div>
        <div style={{ ...rise(frame, 44, 16), display: "flex", gap: 18, marginTop: 44 }}>
          <div style={{ height: 64, padding: "0 30px", display: "flex", alignItems: "center", borderRadius: 10, background: C.ink, color: "#fff", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: "0.1em" }}>
            AESTRODOM.ORG/DASHBOARD/BILLING
          </div>
          <div style={{ height: 64, padding: "0 26px", display: "flex", alignItems: "center", borderRadius: 10, border: `1.5px solid ${C.ink}`, fontWeight: 600, fontSize: 22 }}>@aestrodom_ai</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
