import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { BrandMark, Button, C, Caption, Corner, Cursor, Grid, Label, Sfx, Spinner, Window, display, ease, pressAt, rise, sans } from "./ui";

/**
 * Battleground vote campaign: apps with a token battle for votes, the top-voted app wins a secret
 * reward. 16:9, same light look as the other guides, with a dark "mystery reward" moment.
 */

const SCENES: [React.FC, number][] = [
  [Title, 120],
  [BuildDeploy, 150],
  [LaunchToken, 170],
  [GetVotes, 260],
  [Mystery, 200],
  [Rules, 170],
  [End, 150],
];
const FADE = 15;
export const BATTLE_DURATION = SCENES.reduce((s, [, d]) => s + d, 0) - FADE * (SCENES.length - 1);

export function BattleVote() {
  const starts = SCENES.map((_, i) => SCENES.slice(0, i).reduce((s, [, d]) => s + d, 0) - FADE * i);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Html5Audio
        src={staticFile("sfx/battle-music.wav")}
        volume={(f) => 0.4 * interpolate(f, [BATTLE_DURATION - 60, BATTLE_DURATION], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
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
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

const WX = 120;
const WY = 210;
const BX = WX;
const BY = WY + 52;
const WIN_W = 1680;
const toScreen = (x: number, y: number): [number, number] => [BX + x, BY + y];

function Stage({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <AbsoluteFill style={{ background: dark ? "#050505" : C.bg, fontFamily: sans, color: dark ? "#fff" : C.ink }}>
      {!dark && <Grid opacity={0.7} />}
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

function AppBar({ active }: { active: string }) {
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
      <div style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 6, background: C.ink, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>A</div>
    </div>
  );
}

function Check({ size = 18, color = C.ink }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 L10 17.5 L19 7" />
    </svg>
  );
}

function Chevron({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

/* ---------- Mini app thumbnails ---------- */

type Theme = "sonar" | "meme" | "nexus";

function Thumb({ theme, w, h }: { theme: Theme; w: number; h: number }) {
  const frame = useCurrentFrame();
  if (theme === "sonar") {
    return (
      <div style={{ width: w, height: h, background: "#0e1714", position: "relative", overflow: "hidden", color: "#fff" }}>
        <div style={{ position: "absolute", left: w * 0.06, top: h * 0.3, fontSize: h * 0.1, fontWeight: 800, lineHeight: 1.1 }}>
          The trenches are dark.
          <div style={{ color: "#5eead4" }}>We brought sonar.</div>
        </div>
        <div style={{ position: "absolute", right: w * 0.06, top: h * 0.18, width: h * 0.64, height: h * 0.64, borderRadius: "50%", border: "1px solid #1f3b33" }}>
          <div style={{ position: "absolute", inset: "18%", borderRadius: "50%", border: "1px solid #1f3b33" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `conic-gradient(from ${frame * 4}deg, rgba(94,234,212,.45), transparent 22%)` }} />
        </div>
      </div>
    );
  }
  if (theme === "meme") {
    return (
      <div style={{ width: w, height: h, background: "radial-gradient(circle at 30% 30%, #4c3a5e, #1d1a24)", position: "relative", overflow: "hidden", display: "grid", placeItems: "center" }}>
        <div style={{ fontFamily: "Impact, sans-serif", fontSize: h * 0.2, color: "#fff", letterSpacing: 1, transform: `rotate(${Math.sin(frame / 10) * 2}deg)` }}>MEMEVERSE</div>
        <div style={{ position: "absolute", bottom: h * 0.08, left: -10, right: -10, height: h * 0.1, background: "#facc15", transform: "rotate(-3deg)" }} />
      </div>
    );
  }
  return (
    <div style={{ width: w, height: h, background: "linear-gradient(135deg, #0b1020, #1e1b4b)", position: "relative", overflow: "hidden", color: "#fff" }}>
      <div style={{ position: "absolute", left: w * 0.08, top: h * 0.32, fontSize: h * 0.11, fontWeight: 800 }}>NEXUSMIND AI</div>
      <div style={{ position: "absolute", left: w * 0.08, top: h * 0.5, width: w * 0.4, height: 6, borderRadius: 3, background: "#6366f1" }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", right: w * 0.08 + i * 26, top: h * 0.25 + i * 30, width: 60, height: 60, borderRadius: 30, border: "2px solid #818cf8", opacity: 0.4 + i * 0.2 }} />
      ))}
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
          Aestrodom Battleground
          <span style={{ width: 40, height: 1, background: C.ink }} />
        </div>
        <div style={{ ...rise(frame, 18, 30), marginTop: 24, fontFamily: display, fontWeight: 900, fontSize: 96, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.05 }}>
          Build. Vote.
          <br />
          <span style={{ color: C.faint }}>Win.</span>
        </div>
        <div style={{ ...rise(frame, 34, 16), marginTop: 30, fontSize: 28, color: C.muted }}>The most-voted app wins a secret reward.</div>
      </div>
    </AbsoluteFill>
  );
}

/** 01: build an app and deploy it. */
function BuildDeploy() {
  const frame = useCurrentFrame();
  const deploy = 60;
  const live = 104;
  const btn = toScreen(1680 - 40 - 90, 64 + 40);
  return (
    <Stage>
      <Caption step="01" title="Build and deploy" sub="Describe your app, let Claude build it, then deploy it to its own domain." />
      <Sfx at={live} name="chime" volume={0.5} />
      <Window url="aestrodom.org/project/sonar" style={enter(frame)}>
        <AppBar active="Projects" />
        <div style={{ position: "absolute", right: 40, top: 64 + 18, display: "flex", gap: 12, alignItems: "center" }}>
          {frame >= live ? (
            <div style={{ ...rise(frame, live, 8, 10), display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: 44, borderRadius: 8, border: `1.5px solid ${C.success}`, color: C.success, fontWeight: 700 }}>
              <Check size={16} color={C.success} /> Live at sonar.aestrodom.org
            </div>
          ) : frame >= deploy + 4 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 16 }}>
              <Spinner size={16} /> Deploying…
            </div>
          ) : null}
          <Button pressed={pressAt(frame, deploy)} style={{ width: 180, height: 44, fontSize: 15 }}>
            Deploy
          </Button>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 64 + 90, bottom: 30, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}` }}>
          <Thumb theme="sonar" w={1600} h={620} />
        </div>
      </Window>
      <Cursor start={0} points={[[0, 1500, 950], [40, btn[0], btn[1]], [80, btn[0], btn[1]], [130, 1500, 800]]} clicks={[deploy]} />
    </Stage>
  );
}

/** 02: launch its token; that is the ticket into the vote. */
function LaunchToken() {
  const frame = useCurrentFrame();
  const press = 70;
  const done = 112;
  const mx = WIN_W / 2 - 300;
  const launchPt = toScreen(mx + 300, 64 + 120 + 420 - 30 - 28);
  return (
    <Stage>
      <Caption step="02" title="Launch its token" sub="Only apps with a token on Pons V2 can be voted on. That is your ticket in." />
      <Sfx at={done} name="chime" volume={0.55} />
      <Window url="aestrodom.org/project/sonar" style={{ left: WX, top: WY }}>
        <AppBar active="Projects" />
        <div style={{ position: "absolute", left: 40, right: 40, top: 64 + 90, bottom: 30, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}`, filter: "blur(2px)", opacity: 0.6 }}>
          <Thumb theme="sonar" w={1600} h={620} />
        </div>
        <AbsoluteFill style={{ background: "rgba(0,0,0,.25)" }}>
          <div style={{ ...rise(frame, 6, 20, 14), position: "absolute", left: mx, top: 120, width: 600, height: 420, borderRadius: 18, background: C.bg, padding: 30, boxShadow: "0 30px 80px -20px rgba(0,0,0,.45)" }}>
            <Label>Launch token · Pons V2</Label>
            <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
              <Field label="Name" value="Sonar" />
              <Field label="Symbol" value="$SONAR" />
            </div>
            <div style={{ marginTop: 16 }}>
              <Field label="Rewards wallet (creator)" value="0x4e84…0b72" mono />
            </div>
            <div style={{ marginTop: 18, display: "flex", gap: 22, fontSize: 15, color: C.subtle }}>
              <span>Bonding curve on Robinhood Chain</span>
              <span>·</span>
              <span>Enters the Battleground vote</span>
            </div>
            <div style={{ position: "absolute", left: 30, right: 30, bottom: 30 }}>
              {frame < done ? (
                <Button pressed={pressAt(frame, press)} style={{ width: "100%", height: 56 }}>
                  {frame >= press + 4 ? (
                    <>
                      <Spinner size={16} /> Launching…
                    </>
                  ) : (
                    "Launch $SONAR"
                  )}
                </Button>
              ) : (
                <div style={{ ...rise(frame, done, 8, 10), height: 56, borderRadius: 8, border: `1.5px solid ${C.success}`, color: C.success, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 700, fontSize: 17 }}>
                  <Check size={18} color={C.success} /> $SONAR is live. Sonar entered the Battleground.
                </div>
              )}
            </div>
          </div>
        </AbsoluteFill>
      </Window>
      <Cursor start={0} points={[[0, 1500, 950], [50, launchPt[0], launchPt[1]], [90, launchPt[0], launchPt[1]], [140, 1500, 900]]} clicks={[press]} />
    </Stage>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, color: C.subtle, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 6, height: 48, borderRadius: 10, border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 18, fontFamily: mono ? "ui-monospace, Consolas, monospace" : sans }}>{value}</div>
    </div>
  );
}

/* ---------- 03: the vote ---------- */

const CARD_W = 500;
const CARD_GAP = 30;
const CARD_X0 = (WIN_W - CARD_W * 3 - CARD_GAP * 2) / 2;
const CARD_Y = 64 + 150;
const THUMB_H = 290;
const slotX = (i: number) => CARD_X0 + i * (CARD_W + CARD_GAP);

const APPS: { theme: Theme; name: string; domain: string; symbol: string }[] = [
  { theme: "meme", name: "Memeverse", domain: "memeverse.aestrodom.org", symbol: "MEME" },
  { theme: "sonar", name: "Sonar", domain: "sonar.aestrodom.org", symbol: "SONAR" },
  { theme: "nexus", name: "NexusMind AI", domain: "nexusmind-ai.aestrodom.org", symbol: "NEXUS" },
];

function GetVotes() {
  const frame = useCurrentFrame();
  const click = 70;
  const swap = 150;
  // Votes over time: Sonar climbs past Memeverse.
  const votes = [
    Math.round(ease(frame, [0, 200], [38, 44])),
    Math.round(ease(frame, [20, click], [31, 33])) + (frame >= click ? 1 : 0) + Math.round(ease(frame, [click + 10, swap], [0, 14])),
    Math.round(ease(frame, [0, 200], [12, 17])),
  ];
  // Slot of each app: before the swap Memeverse #1, Sonar #2; after, Sonar #1.
  const t = ease(frame, [swap, swap + 24], [0, 1]);
  const slots = [interpolate(t, [0, 1], [0, 1]), interpolate(t, [0, 1], [1, 0]), 2];
  const voteBtn = toScreen(slotX(1) + CARD_W - 20 - 50, CARD_Y + THUMB_H + 30 + 20);
  return (
    <Stage>
      <Caption step="03" title="Get votes" sub="Share your app. Holders of $AESTRODOM vote for their favourites on the Battleground." />
      <Sfx at={swap + 4} name="swell" volume={0.5} />
      {[96, 112, 124, 134, 142].map((f) => (
        <Sfx key={f} at={f} name="tick" volume={0.3} />
      ))}
      <Window url="aestrodom.org/battleground" style={enter(frame)}>
        <AppBar active="Battleground" />
        <div style={{ position: "absolute", left: CARD_X0, top: 64 + 34, fontFamily: display, fontWeight: 800, fontSize: 34, letterSpacing: "0.06em" }}>BATTLEGROUND</div>
        <div style={{ position: "absolute", left: CARD_X0, top: 64 + 92, display: "flex", gap: 6 }}>
          {["Trending", "Top voted", "Curve progress", "All apps"].map((tab, i) => (
            <div key={tab} style={{ padding: "6px 14px", fontSize: 14, border: `1px solid ${i === 0 ? C.ink : C.line}`, color: i === 0 ? C.ink : C.subtle }}>
              {tab}
            </div>
          ))}
        </div>
        {APPS.map((a, i) => {
          const slot = slots[i]!;
          const rank = Math.round(slot) + 1;
          const voted = i === 1 && frame >= click;
          const up = i === 1 && frame >= click ? pressAt(frame, click) : 0;
          return (
            <div key={a.name} style={{ position: "absolute", left: interpolate(slot, [0, 2], [slotX(0), slotX(2)]), top: CARD_Y - (i === 1 ? Math.sin(t * Math.PI) * 30 : 0), width: CARD_W, border: `1px solid ${rank === 1 ? C.ink : C.line}`, background: C.bg, zIndex: i === 1 ? 2 : 1, boxShadow: rank === 1 ? "0 30px 60px -30px rgba(0,0,0,.4)" : "none" }}>
              <div style={{ position: "relative" }}>
                <Thumb theme={a.theme} w={CARD_W - 2} h={THUMB_H} />
                <div style={{ position: "absolute", left: 12, top: 12, background: C.ink, color: "#fff", padding: "3px 10px", fontFamily: "ui-monospace, Consolas, monospace", fontSize: 15 }}>#{String(rank).padStart(2, "0")}</div>
                {rank === 1 && frame >= swap + 20 && (
                  <div style={{ ...rise(frame, swap + 20, 8, 10), position: "absolute", right: 12, top: 12, background: "#fff", color: C.ink, padding: "4px 12px", fontSize: 14, fontWeight: 700 }}>App of the day</div>
                )}
              </div>
              <div style={{ padding: "18px 20px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{a.name}</div>
                  <div style={{ fontSize: 14, color: C.subtle, fontFamily: "ui-monospace, Consolas, monospace", marginTop: 4 }}>{a.domain}</div>
                  <div style={{ marginTop: 12, fontSize: 14, fontFamily: "ui-monospace, Consolas, monospace", fontWeight: 700 }}>${a.symbol}</div>
                </div>
                <div style={{ height: 42, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, border: `1.5px solid ${voted ? C.ink : C.line}`, background: voted ? C.ink : C.bg, color: voted ? "#fff" : C.ink, fontWeight: 700, fontSize: 17, transform: `scale(${1 + up * 0.08})` }}>
                  <Chevron /> {votes[i]}
                </div>
              </div>
            </div>
          );
        })}
      </Window>
      <Cursor start={0} points={[[0, 1500, 980], [50, voteBtn[0], voteBtn[1]], [90, voteBtn[0], voteBtn[1]], [130, 1650, 1000]]} clicks={[click]} />
    </Stage>
  );
}

/** 04: the prize stays a secret. */
function Mystery() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 10, fps, config: { damping: 11, mass: 0.9 } });
  const shake = frame > 50 && frame < 120 ? Math.sin(frame * 1.7) * ease(frame, [50, 80], [0, 6]) * ease(frame, [100, 120], [1, 0]) : 0;
  const lid = ease(frame, [118, 140], [0, -46]);
  const glow = ease(frame, [118, 150], [0, 1]);
  return (
    <Stage dark>
      <Sfx at={10} name="pop" volume={0.6} />
      <Sfx at={118} name="swell" volume={0.6} />
      <Sfx at={140} name="chime" volume={0.6} />
      <AbsoluteFill style={{ background: `radial-gradient(600px 420px at 50% 52%, rgba(255,255,255,${0.06 + glow * 0.12}), transparent 70%)` }} />
      {/* light rays */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: glow }}>
        <div style={{ width: 1400, height: 1400, background: `repeating-conic-gradient(from ${frame * 0.6}deg, rgba(255,255,255,.08) 0deg 6deg, transparent 6deg 20deg)`, WebkitMaskImage: "radial-gradient(circle, #000 10%, transparent 55%)", maskImage: "radial-gradient(circle, #000 10%, transparent 55%)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 300, height: 260, marginTop: -60, transform: `scale(${pop}) rotate(${shake}deg)` }}>
          {/* lid */}
          <div style={{ position: "absolute", left: -18, top: 0, width: 336, height: 70, borderRadius: 10, background: "#fff", transform: `translateY(${lid}px) rotate(${lid / 8}deg)`, transformOrigin: "left bottom", zIndex: 2 }}>
            <div style={{ position: "absolute", left: 148, top: 0, width: 40, height: 70, background: "#111" }} />
          </div>
          {/* box */}
          <div style={{ position: "absolute", left: 0, top: 70, width: 300, height: 190, borderRadius: "0 0 12px 12px", background: "#e5e5e5" }}>
            <div style={{ position: "absolute", left: 130, top: 0, width: 40, height: 190, background: "#111" }} />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: display, fontWeight: 900, fontSize: 120, color: "#111", opacity: 1 - glow * 0.2 }}>
              <span style={{ background: "#e5e5e5", padding: "0 18px", lineHeight: 1 }}>?</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center" }}>
        <div style={{ ...rise(frame, 30, 20), fontFamily: display, fontWeight: 900, fontSize: 72, letterSpacing: "0.1em" }}>SECRET REWARD</div>
        <div style={{ ...rise(frame, 46, 16), marginTop: 18, fontSize: 28, color: "#a1a1aa" }}>The most-voted app wins it. What&apos;s inside? Only the winner finds out.</div>
      </div>
    </Stage>
  );
}

/** 05: the rules, short. */
function Rules() {
  const frame = useCurrentFrame();
  const rules = [
    ["Have a token", "Only apps that launched a token on Pons V2 are in the vote."],
    ["Fair votes", "Voters hold at least $1 of $AESTRODOM. One vote per account per app."],
    ["No self-votes", "You can't vote for your own app."],
    ["Paid on-chain", "The reward goes to the creator wallet of the winning app's token."],
  ];
  return (
    <Stage>
      <Caption step="04" title="The rules" sub="Simple, on-chain, and the same for everyone." />
      <div style={{ position: "absolute", left: 120, top: 260, width: 1680, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
        {rules.map(([t, d], i) => (
          <div key={t} style={{ ...rise(frame, 12 + i * 8, 24), position: "relative", height: 250, border: `1px solid ${C.line}`, borderRadius: 20, background: C.bg, padding: 36, boxShadow: "0 20px 40px -28px rgba(15,23,42,.35)" }}>
            <Corner pos="tl" style={{ position: "absolute", left: 14, top: 14 }} />
            <Corner pos="br" style={{ position: "absolute", right: 14, bottom: 14 }} />
            <div style={{ fontSize: 16, color: C.faint, fontWeight: 700, letterSpacing: "0.2em" }}>0{i + 1}</div>
            <div style={{ marginTop: 40, fontFamily: display, fontWeight: 800, fontSize: 36, letterSpacing: "0.04em" }}>{t}</div>
            <div style={{ marginTop: 14, fontSize: 23, color: C.muted, lineHeight: 1.4 }}>{d}</div>
          </div>
        ))}
      </div>
      {rules.map(([t], i) => (
        <Sfx key={t} at={12 + i * 8} name="tick" volume={0.35} />
      ))}
    </Stage>
  );
}

function End() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 15 } });
  const steps = ["Build your app", "Launch its token", "Get votes", "Win the secret reward"];
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
          <div style={{ height: 64, padding: "0 30px", display: "flex", alignItems: "center", borderRadius: 10, background: C.ink, color: "#fff", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: "0.1em" }}>AESTRODOM.ORG/BATTLEGROUND</div>
          <div style={{ height: 64, padding: "0 26px", display: "flex", alignItems: "center", borderRadius: 10, border: `1.5px solid ${C.ink}`, fontWeight: 600, fontSize: 22 }}>@aestrodom_ai</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
