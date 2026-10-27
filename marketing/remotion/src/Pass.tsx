import React from "react";
import { AbsoluteFill, Html5Audio, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Sfx, display, ease, sans } from "./ui";

/**
 * Aestrodom Pass launch teaser. 1080×1080, dark and cosmic, built around the pass artwork.
 * Timeline (frames at 30 fps) matches make-pass-music.mjs: reveal impact at 100, beat at 280,
 * mint reveal impact at 700.
 */
export const PASS_DURATION = 960;

const T = { reveal: 100, perks: 280, flow: 520, mint: 700, end: 850 } as const;
const W = 1080;
const CARD = 640;
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

export function PassTeaser() {
  return (
    <AbsoluteFill style={{ background: "#030304", color: "#fff", fontFamily: sans, overflow: "hidden" }}>
      <Html5Audio src={staticFile("sfx/pass-music.wav")} volume={0.6} />
      <Sfx at={T.perks - 6} name="whoosh" volume={0.3} />
      <Sfx at={T.flow - 6} name="whoosh" volume={0.3} />
      <Sfx at={T.end - 6} name="whoosh" volume={0.3} />

      <Stars />
      <Nebula />
      <Card />
      <Flash at={T.reveal} />
      <Flash at={T.mint} strength={0.55} />

      <Sequence from={0} durationInFrames={T.reveal + 4} layout="none">
        <Intro />
      </Sequence>
      <Sequence from={T.reveal} durationInFrames={T.perks - T.reveal} layout="none">
        <Reveal />
      </Sequence>
      <Sequence from={T.perks} durationInFrames={T.flow - T.perks} layout="none">
        <Perks />
      </Sequence>
      <Sequence from={T.flow} durationInFrames={T.mint - T.flow} layout="none">
        <Flow />
      </Sequence>
      <Sequence from={T.mint} durationInFrames={T.end - T.mint} layout="none">
        <Mint />
      </Sequence>
      <Sequence from={T.end} layout="none">
        <End />
      </Sequence>
      <Vignette />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Background                                                          */
/* ------------------------------------------------------------------ */

const STARS = Array.from({ length: 170 }, (_, i) => ({
  x: random(`x${i}`) * W,
  y: random(`y${i}`) * W,
  r: 0.6 + random(`r${i}`) ** 3 * 2.4,
  depth: 0.2 + random(`d${i}`) * 0.8,
  phase: random(`p${i}`) * Math.PI * 2,
}));

function Stars() {
  const f = useCurrentFrame();
  // Warp: stars stream outwards just before each impact.
  const warp = ease(f, [T.reveal - 40, T.reveal], [0, 1]) * ease(f, [T.reveal, T.reveal + 20], [1, 0]) + ease(f, [T.mint - 30, T.mint], [0, 0.7]) * ease(f, [T.mint, T.mint + 20], [1, 0]);
  return (
    <AbsoluteFill>
      {STARS.map((s, i) => {
        const dx = s.x - W / 2;
        const dy = s.y - W / 2;
        const push = 1 + warp * s.depth * 0.6 + f * 0.0004 * s.depth;
        const x = W / 2 + dx * push;
        const y = W / 2 + dy * push - f * 0.08 * s.depth;
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(f / (18 + s.depth * 30) + s.phase));
        const len = warp * s.depth * 40;
        const angle = Math.atan2(dy, dx);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: ((x % W) + W) % W,
              top: ((y % W) + W) % W,
              width: s.r * 2 + len,
              height: s.r * 2,
              borderRadius: s.r,
              background: "#fff",
              opacity: tw * (0.35 + s.depth * 0.65),
              transform: `rotate(${angle}rad)`,
              transformOrigin: "0 50%",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Nebula() {
  const f = useCurrentFrame();
  const glow = ease(f, [T.reveal - 20, T.reveal + 30], [0.15, 0.55]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${50 + 6 * Math.sin(f / 90)}% ${46 + 4 * Math.cos(f / 110)}%, rgba(255,255,255,${glow * 0.22}) 0%, rgba(255,255,255,0) 52%)`,
      }}
    />
  );
}

function Vignette() {
  return <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)", pointerEvents: "none" }} />;
}

function Flash({ at, strength = 1 }: { at: number; strength?: number }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [at - 3, at, at + 18], [0, strength, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#fff", opacity: o, pointerEvents: "none" }} />;
}

/* ------------------------------------------------------------------ */
/* The card, keyframed across the whole video                          */
/* ------------------------------------------------------------------ */

type Key = [frame: number, cx: number, cy: number, scale: number, opacity: number];
const KEYS: Key[] = [
  [T.reveal - 1, 540, 470, 0.55, 0],
  [T.reveal + 40, 540, 470, 1, 1],
  [T.perks - 10, 540, 470, 1, 1],
  [T.perks + 20, 540, 372, 0.78, 1],
  [T.flow - 10, 540, 372, 0.78, 1],
  [T.flow + 20, 540, 330, 0.6, 1],
  [T.mint - 6, 540, 330, 0.6, 1],
  [T.mint + 10, 540, 540, 1.55, 0.16],
  [T.end - 10, 540, 540, 1.6, 0.16],
  [T.end + 25, 540, 455, 0.86, 1],
  [PASS_DURATION, 540, 455, 0.9, 1],
];

function keyed(f: number, idx: 1 | 2 | 3 | 4) {
  const frames = KEYS.map((k) => k[0]);
  const values = KEYS.map((k) => k[idx]);
  return interpolate(f, frames, values, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });
}

function Card() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < T.reveal - 1) return null;
  const pop = spring({ frame: f - T.reveal, fps, config: { damping: 14, stiffness: 90, mass: 0.9 } });
  const cx = keyed(f, 1);
  const cy = keyed(f, 2);
  const scale = keyed(f, 3) * (f < T.reveal + 40 ? 0.55 + 0.45 * pop : 1);
  const opacity = keyed(f, 4);
  const rotY = (f < T.reveal + 50 ? interpolate(f, [T.reveal, T.reveal + 50], [-35, 0], { extrapolateRight: "clamp" }) : 0) + 9 * Math.sin(f / 46);
  const rotX = 5 * Math.cos(f / 58);
  const floatY = 8 * Math.sin(f / 34);
  // A light sweep across the card every 4 seconds.
  const sweep = ((f - T.reveal) % 120) / 120;
  const size = CARD * scale;
  return (
    <div style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2 + floatY, width: size, height: size, opacity, perspective: 1600 }}>
      <div
        style={{
          position: "absolute",
          inset: -size * 0.12,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 62%)",
          filter: "blur(10px)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`, transformStyle: "preserve-3d" }}>
        <Img src={staticFile("aestrodom-pass.png")} style={{ width: "100%", height: "100%", display: "block", boxShadow: "0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.12)" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            mixBlendMode: "screen",
            background: `linear-gradient(115deg, rgba(255,255,255,0) ${sweep * 160 - 40}%, rgba(255,255,255,0.32) ${sweep * 160 - 25}%, rgba(255,255,255,0) ${sweep * 160 - 10}%)`,
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scenes (text layers over the card)                                  */
/* ------------------------------------------------------------------ */

function Kicker({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: mono, fontSize: 20, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", ...style }}>{children}</div>;
}

function fadeUp(f: number, at: number, out?: number): React.CSSProperties {
  const o = ease(f, [at, at + 16], [0, 1]) * (out === undefined ? 1 : ease(f, [out, out + 12], [1, 0]));
  return { opacity: o, transform: `translateY(${ease(f, [at, at + 22], [26, 0])}px)` };
}

function Intro() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 26 }}>
      <Kicker style={fadeUp(f, 6, 88)}>Robinhood Chain</Kicker>
      <div style={{ ...fadeUp(f, 14, 88), fontFamily: display, fontWeight: 800, fontSize: 52, letterSpacing: "0.06em", lineHeight: 1.2 }}>
        LAUNCHING A TOKEN
        <br />
        <span style={{ color: "rgba(255,255,255,0.45)" }}>COSTS A FEE.</span>
      </div>
      <div style={{ ...fadeUp(f, 52, 88), fontFamily: display, fontWeight: 900, fontSize: 64, letterSpacing: "0.08em" }}>NOT WITH THIS.</div>
    </AbsoluteFill>
  );
}

function Reveal() {
  const f = useCurrentFrame();
  const spacing = ease(f, [30, 90], [0.6, 0.16]);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 46, textAlign: "center" }}>
        <Kicker style={fadeUp(f, 30, 165)}>NFT · 500 Supply</Kicker>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, textAlign: "center", ...fadeUp(f, 34, 168) }}>
        <div style={{ fontFamily: display, fontWeight: 900, fontSize: 70, letterSpacing: `${spacing}em`, lineHeight: 1 }}>AESTRODOM</div>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: "0.7em", color: "rgba(255,255,255,0.6)", marginTop: 14, paddingLeft: "0.7em" }}>PASS</div>
      </div>
    </AbsoluteFill>
  );
}

const PERKS: [string, string, string][] = [
  ["01", "One free token launch", "every single day"],
  ["02", "We pay the launch fee", "and the gas"],
  ["03", "Creator fees go", "straight to your wallet"],
];

function Perks() {
  const f = useCurrentFrame();
  const each = 76;
  return (
    <AbsoluteFill>
      {PERKS.map(([n, a, b], i) => {
        const at = 18 + i * each;
        const out = i < PERKS.length - 1 ? at + each - 14 : 226;
        return (
          <React.Fragment key={n}>
            <Sfx at={at} name="pop" volume={0.35} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 712, textAlign: "center", ...fadeUp(f, at, out) }}>
              <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.3em", color: "rgba(255,255,255,0.5)" }}>{n} / 03</div>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 54, letterSpacing: "0.03em", marginTop: 18, lineHeight: 1.15 }}>{a.toUpperCase()}</div>
              <div style={{ fontSize: 34, fontWeight: 500, color: "rgba(255,255,255,0.7)", marginTop: 12 }}>{b}</div>
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
}

const STEPS = ["Mint the pass", "Build an app", "Launch free", "Earn fees"];

function Flow() {
  const f = useCurrentFrame();
  const step = 34;
  const rowY = 690;
  const xs = [150, 410, 670, 930];
  const progress = ease(f, [20, 20 + step * 3], [0, 1]);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 590, textAlign: "center" }}>
        <Kicker style={fadeUp(f, 4, 166)}>How it works</Kicker>
      </div>
      <div style={{ position: "absolute", left: xs[0], top: rowY - 1, width: xs[3] - xs[0], height: 2, background: "rgba(255,255,255,0.15)", opacity: ease(f, [6, 18], [0, 1]) * ease(f, [166, 178], [1, 0]) }} />
      <div style={{ position: "absolute", left: xs[0], top: rowY - 1, width: (xs[3] - xs[0]) * progress, height: 2, background: "#fff", boxShadow: "0 0 16px rgba(255,255,255,0.8)", opacity: ease(f, [166, 178], [1, 0]) }} />
      {STEPS.map((label, i) => {
        const at = 20 + i * step;
        const lit = ease(f, [at, at + 10], [0, 1]);
        return (
          <React.Fragment key={label}>
            <Sfx at={at} name="tick" volume={0.5} />
            <div style={{ position: "absolute", left: xs[i] - 70, width: 140, top: rowY - 26, textAlign: "center", ...fadeUp(f, 6 + i * 4, 166) }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  margin: "0 auto",
                  borderRadius: 26,
                  border: "2px solid rgba(255,255,255,0.5)",
                  background: `rgba(255,255,255,${lit})`,
                  color: lit > 0.5 ? "#000" : "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: mono,
                  fontSize: 20,
                  fontWeight: 700,
                  boxShadow: `0 0 ${30 * lit}px rgba(255,255,255,${0.7 * lit})`,
                }}
              >
                {i + 1}
              </div>
              <div style={{ marginTop: 22, fontSize: 25, fontWeight: 700, lineHeight: 1.2, opacity: 0.45 + 0.55 * lit }}>{label}</div>
            </div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontSize: 28, color: "rgba(255,255,255,0.7)", ...fadeUp(f, 20 + step * 3 + 10, 166) }}>
        One pass = one free launch, every day.
      </div>
    </AbsoluteFill>
  );
}

function Mint() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 12, stiffness: 120 } });
  const stats: [string, string][] = [
    ["500", "Supply"],
    ["1/DAY", "Free launch"],
    ["1", "Per wallet"],
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Kicker style={fadeUp(f, 8, 138)}>Aestrodom Pass</Kicker>
      <div style={{ fontFamily: display, fontWeight: 900, fontSize: 128, letterSpacing: "0.04em", lineHeight: 1, marginTop: 24, transform: `scale(${0.8 + 0.2 * pop})`, opacity: ease(f, [0, 8], [0, 1]) * ease(f, [138, 150], [1, 0]) }}>
        FREE MINT
      </div>
      <div style={{ display: "flex", gap: 0, marginTop: 56, ...fadeUp(f, 24, 138) }}>
        {stats.map(([v, k], i) => (
          <div key={k} style={{ width: 250, borderLeft: i ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 56 }}>{v}</div>
            <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginTop: 10 }}>{k}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 64,
          padding: "18px 34px",
          border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: 999,
          fontFamily: mono,
          fontSize: 24,
          letterSpacing: "0.12em",
          display: "flex",
          alignItems: "center",
          gap: 16,
          ...fadeUp(f, 44, 138),
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 6, background: "#22c55e", boxShadow: `0 0 0 ${6 + 3 * Math.sin(f / 6)}px rgba(34,197,94,0.2)` }} />
        OPENS OCT 19 · 07:19 UTC
      </div>
    </AbsoluteFill>
  );
}

function End() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 46, display: "flex", justifyContent: "center", alignItems: "center", gap: 14, ...fadeUp(f, 14) }}>
        <Mark size={34} />
        <span style={{ fontFamily: display, fontWeight: 900, fontSize: 26, letterSpacing: "0.18em" }}>AESTRODOM</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 74, textAlign: "center", ...fadeUp(f, 26) }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 46, letterSpacing: "0.05em" }}>aestrodom.org/pass</div>
        <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.2em", color: "rgba(255,255,255,0.6)", marginTop: 14 }}>@AESTRODOM_AI</div>
      </div>
    </AbsoluteFill>
  );
}

/** The brand mark in its dark-background colours. */
function Mark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <g strokeLinejoin="round" strokeWidth="2.5">
        <path d="M32 5 L33 39 L4 57 Z" fill="#3f3f46" stroke="#3f3f46" />
        <path d="M32 5 L60 57 L33 39 Z" fill="#ffffff" stroke="#ffffff" />
        <path d="M4 57 L33 39 L60 57 Z" fill="#a1a1aa" stroke="#a1a1aa" />
      </g>
    </svg>
  );
}
