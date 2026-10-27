import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Sfx, TypingSound, display, ease, rise, sans, typed } from "./ui";

/**
 * 20 s square teaser for social posts, dark theme. Cuts land on the beat of the music bed:
 * music.wav is entered at 9 s, where its drums start, so frame 0 is a kick and a bar is 75 frames (96 BPM).
 */
const BAR = 75;
const BEAT = BAR / 4;
export const PROMO_DURATION = BAR * 8;

const D = {
  bg: "#050505",
  fg: "#ffffff",
  muted: "#a1a1aa",
  subtle: "#52525b",
  line: "#1c1c20",
  card: "#0c0c0e",
  green: "#22c55e",
};
const mono = "ui-monospace, 'JetBrains Mono', Consolas, monospace";

const SCENES: [React.FC, number][] = [
  [Hook, BAR],
  [Prompt, BAR * 2],
  [Live, BAR],
  [Token, BAR],
  [Steps, BAR],
  [Outro, BAR * 2],
];

export function Promo() {
  const starts = SCENES.map((_, i) => SCENES.slice(0, i).reduce((s, [, d]) => s + d, 0));
  return (
    <AbsoluteFill style={{ background: D.bg, color: D.fg, fontFamily: sans }}>
      <Html5Audio
        src={staticFile("sfx/music.wav")}
        trimBefore={9 * 30}
        volume={(f) => 0.5 * interpolate(f, [0, 6, PROMO_DURATION - 45, PROMO_DURATION], [0.6, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      {starts.slice(1).map((s) => (
        <Sfx key={s} at={s - 5} name="whoosh" volume={0.35} />
      ))}
      {SCENES.map(([Scene, d], i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={d}>
          <Scene />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function DarkGrid({ opacity = 1 }: { opacity?: number }) {
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: `linear-gradient(to right, ${D.line} 1px, transparent 1px), linear-gradient(to bottom, ${D.line} 1px, transparent 1px)`,
        backgroundSize: "54px 54px",
        backgroundPosition: "-1px -1px",
        maskImage: "radial-gradient(circle at 50% 50%, #000 30%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 30%, transparent 75%)",
      }}
    />
  );
}

function Mark({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={style}>
      <g strokeLinejoin="round" strokeWidth="2.5">
        <path d="M32 5 L33 39 L4 57 Z" fill="#3f3f46" stroke="#3f3f46" />
        <path d="M32 5 L60 57 L33 39 Z" fill="#ffffff" stroke="#ffffff" />
        <path d="M4 57 L33 39 L60 57 Z" fill="#a1a1aa" stroke="#a1a1aa" />
      </g>
    </svg>
  );
}

/** Small label at the top of a scene. */
function Tag({ children, start = 2 }: { children: React.ReactNode; start?: number }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ ...rise(frame, start, 14, 12), position: "absolute", top: 90, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 16, fontSize: 22, fontWeight: 600, letterSpacing: "0.32em", textTransform: "uppercase", color: D.muted }}>
      <span style={{ width: 40, height: 1, background: D.fg }} />
      {children}
      <span style={{ width: 40, height: 1, background: D.fg }} />
    </div>
  );
}

/** Scale punch on a beat: 1.06 → 1 over a few frames. */
const punch = (frame: number, at: number) => interpolate(frame, [at, at + 8], [1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

/** Four words, one per beat. */
function Hook() {
  const frame = useCurrentFrame();
  const words = ["ONE", "SENTENCE.", "ONE", "LIVE APP."];
  const i = Math.min(3, Math.floor(frame / BEAT));
  const at = i * BEAT;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {words.map((_, k) => (
        <Sfx key={k} at={k * BEAT} name="tick" volume={0.5} />
      ))}
      <DarkGrid opacity={0.7} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${punch(frame, at)})` }}>
        <div style={{ fontFamily: display, fontWeight: 900, fontSize: 92, letterSpacing: "0.06em", color: D.muted, opacity: i % 2 }}>ONE</div>
        <div style={{ fontFamily: display, fontWeight: 900, fontSize: 132, letterSpacing: "0.02em", lineHeight: 1.1, color: D.fg }}>{words[i]}</div>
      </div>
    </AbsoluteFill>
  );
}

/** The prompt is typed, sent, and the agent ticks through the files it writes. */
function Prompt() {
  const frame = useCurrentFrame();
  const text = "build me a meme leaderboard with a token";
  const sendAt = 52;
  const shown = typed(text, frame, 6, 34);
  const sent = frame >= sendAt;
  const steps = ["app/page.tsx", "components/Leaderboard.tsx", "components/VoteButton.tsx", "Build passed"];
  return (
    <AbsoluteFill>
      <TypingSound text={text} start={6} cps={34} volume={0.25} />
      <Sfx at={sendAt} name="click" volume={0.9} />
      {steps.map((_, k) => (
        <Sfx key={k} at={sendAt + 22 + k * BEAT} name="pop" volume={0.35} />
      ))}
      <DarkGrid opacity={0.5} />
      <Tag>01 · Describe it</Tag>

      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: ease(frame, [sendAt, sendAt + 16], [440, 230]),
          padding: "34px 36px",
          background: D.card,
          border: `1px solid ${sent ? D.subtle : "#2a2a30"}`,
          borderRadius: 22,
          display: "flex",
          alignItems: "center",
          gap: 22,
          fontFamily: mono,
          fontSize: 29,
          boxShadow: "0 40px 80px -30px rgba(0,0,0,.8)",
        }}
      >
        <span style={{ color: D.subtle }}>›</span>
        <span style={{ flex: 1 }}>
          {shown}
          {!sent && <span style={{ display: "inline-block", width: 16, height: 38, marginLeft: 4, verticalAlign: "-6px", background: D.fg, opacity: Math.floor(frame / 9) % 2 ? 0 : 1 }} />}
        </span>
        <span style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 14, background: D.fg, color: D.bg, display: "grid", placeItems: "center", fontSize: 34, fontFamily: sans, fontWeight: 700, transform: `scale(${interpolate(frame, [sendAt, sendAt + 3, sendAt + 9], [1, 0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})` }}>
          ↑
        </span>
      </div>

      <div style={{ position: "absolute", left: 120, right: 120, top: 470 }}>
        <div style={{ ...rise(frame, sendAt + 8, 14, 12), display: "flex", alignItems: "center", gap: 16, fontSize: 26, fontWeight: 600, color: D.muted, marginBottom: 30 }}>
          <Mark size={34} />
          Claude is building…
        </div>
        {steps.map((s, k) => {
          const at = sendAt + 22 + k * BEAT;
          const done = k === steps.length - 1;
          return (
            <div key={s} style={{ ...rise(frame, at, 18, 10), display: "flex", alignItems: "center", gap: 20, padding: "16px 0", borderTop: `1px solid ${D.line}`, fontFamily: done ? sans : mono, fontSize: 30, fontWeight: done ? 700 : 400, color: done ? D.green : D.fg }}>
              <span style={{ width: 34, height: 34, borderRadius: 17, display: "grid", placeItems: "center", background: done ? D.green : "#1f1f23", color: done ? D.bg : D.fg, fontSize: 20, fontFamily: sans, fontWeight: 800 }}>✓</span>
              {s}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** The app pops up live on its own subdomain. */
function Live() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, mass: 0.7 } });
  const rows: [string, string, number][] = [
    ["🐸", "pepe.jpg", 4210],
    ["🐕", "doge_moon.gif", 3874],
    ["🚀", "to_the_moon.png", 2950],
    ["😹", "cat_vibes.mp4", 2133],
  ];
  return (
    <AbsoluteFill>
      <Sfx at={2} name="swell" volume={0.5} />
      <DarkGrid opacity={0.5} />
      <Tag>02 · Live in seconds</Tag>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 200,
          width: 860,
          height: 640,
          borderRadius: 22,
          overflow: "hidden",
          background: "#ffffff",
          color: "#000",
          transform: `scale(${0.6 + pop * 0.4}) rotate(${(1 - pop) * -4}deg)`,
          opacity: Math.min(1, pop * 1.5),
          boxShadow: "0 50px 120px -30px rgba(255,255,255,.18)",
        }}
      >
        <div style={{ height: 64, background: "#f3f4f6", display: "flex", alignItems: "center", padding: "0 24px", gap: 10 }}>
          {[0, 1, 2].map((k) => (
            <span key={k} style={{ width: 14, height: 14, borderRadius: 7, background: "#d1d5db" }} />
          ))}
          <div style={{ flex: 1, margin: "0 30px", height: 38, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#4b5563", gap: 8 }}>
            <span style={{ color: "#15803d" }}>🔒</span>memeboard.<b style={{ color: "#000" }}>aestrodom.org</b>
          </div>
        </div>
        <div style={{ padding: "34px 44px" }}>
          <div style={{ fontFamily: display, fontWeight: 900, fontSize: 40, letterSpacing: "0.06em" }}>MEME BOARD 🏆</div>
          <div style={{ fontSize: 20, color: "#6b7280", marginTop: 6, marginBottom: 22 }}>Vote the internet's finest. Top meme wins $MEME.</div>
          {rows.map(([e, n, v], k) => (
            <div key={n} style={{ ...rise(frame, 8 + k * 5, 16, 10), display: "flex", alignItems: "center", gap: 20, padding: "16px 20px", marginBottom: 10, borderRadius: 14, background: k === 0 ? "#000" : "#f9fafb", color: k === 0 ? "#fff" : "#000" }}>
              <b style={{ width: 30, fontSize: 22, opacity: 0.6 }}>#{k + 1}</b>
              <span style={{ fontSize: 34 }}>{e}</span>
              <span style={{ flex: 1, fontSize: 24, fontWeight: 600 }}>{n}</span>
              <b style={{ fontSize: 24 }}>▲ {Math.round(ease(frame, [8, 60], [v * 0.6, v])).toLocaleString("en-US")}</b>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...rise(frame, 18, 20, 12), position: "absolute", right: 70, top: 160, padding: "14px 26px", borderRadius: 999, background: D.green, color: D.bg, fontSize: 26, fontWeight: 800, letterSpacing: "0.2em", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: D.bg, opacity: Math.floor(frame / 8) % 2 ? 0.3 : 1 }} />
        LIVE
      </div>
    </AbsoluteFill>
  );
}

/** One click launches the app's token on Robinhood Chain. */
function Token() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 2, fps, config: { damping: 12 } });
  const progress = ease(frame, [14, 66], [0, 0.68]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Sfx at={2} name="pop" volume={0.6} />
      <Sfx at={40} name="chime" volume={0.45} />
      <DarkGrid opacity={0.5} />
      <Tag>03 · Launch a token</Tag>
      <div style={{ width: 820, padding: 54, borderRadius: 28, background: D.card, border: `1px solid ${D.subtle}`, transform: `scale(${pop})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 120, height: 120, borderRadius: 60, background: D.fg, color: D.bg, display: "grid", placeItems: "center", fontSize: 64 }}>🐸</div>
          <div>
            <div style={{ fontFamily: display, fontWeight: 900, fontSize: 66, letterSpacing: "0.04em" }}>$MEME</div>
            <div style={{ fontSize: 24, color: D.muted, marginTop: 6 }}>Launched via Pons V2 · Robinhood Chain</div>
          </div>
        </div>
        <div style={{ marginTop: 50, display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 600, letterSpacing: "0.18em", color: D.muted, textTransform: "uppercase" }}>
          <span>Bonding curve</span>
          <span style={{ color: D.fg }}>{Math.round(progress * 100)}%</span>
        </div>
        <div style={{ marginTop: 16, height: 18, borderRadius: 9, background: "#1f1f23", overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 9, background: `linear-gradient(90deg, ${D.muted}, ${D.fg})` }} />
        </div>
        <div style={{ ...rise(frame, 36, 14, 10), marginTop: 40, display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 700, color: D.green }}>✓ Token launched — wallet signed, on-chain.</div>
      </div>
    </AbsoluteFill>
  );
}

/** Describe / Build / Deploy / Launch, one per beat, flashing full-frame. */
function Steps() {
  const frame = useCurrentFrame();
  const words = ["DESCRIBE", "BUILD", "DEPLOY", "LAUNCH"];
  const i = Math.min(3, Math.floor(frame / BEAT));
  const inverted = i === 3;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: inverted ? D.fg : D.bg, color: inverted ? D.bg : D.fg }}>
      {words.map((_, k) => (
        <Sfx key={k} at={k * BEAT} name="tick" volume={0.55} />
      ))}
      {!inverted && <DarkGrid opacity={0.6} />}
      <div style={{ position: "absolute", top: 300, fontFamily: display, fontSize: 34, fontWeight: 700, letterSpacing: "0.3em", opacity: 0.5 }}>0{i + 1}</div>
      <div style={{ fontFamily: display, fontWeight: 900, fontSize: 150, letterSpacing: "0.04em", transform: `scale(${punch(frame, i * BEAT)})` }}>{words[i]}</div>
      <div style={{ position: "absolute", bottom: 300, display: "flex", gap: 18 }}>
        {words.map((w, k) => (
          <span key={w} style={{ width: 70, height: 8, borderRadius: 4, background: inverted ? D.bg : D.fg, opacity: k <= i ? 1 : 0.2 }} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** Mark in orbit, wordmark, "$AESTRODOM is live", where to find us. */
function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
  const word = "AESTRODOM";
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <Sfx at={2} name="swell" volume={0.5} />
      <Sfx at={44} name="chime" volume={0.5} />
      <DarkGrid opacity={ease(frame, [0, 20], [0, 0.8])} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 36%, rgba(255,255,255,.10), transparent 45%)" }} />

      <svg viewBox="0 0 400 400" width={520} height={520} style={{ position: "absolute", top: 60, overflow: "visible", opacity: ease(frame, [0, 16], [0, 1]) }}>
        <circle cx="200" cy="200" r="190" stroke={D.subtle} strokeWidth="1" fill="none" opacity=".6" />
        <circle cx="200" cy="200" r="150" stroke={D.subtle} strokeWidth="1" strokeDasharray="2 7" fill="none" transform={`rotate(${frame * 0.6} 200 200)`} />
        <g transform={`rotate(${-18 + frame * 0.25} 200 200)`}>
          <ellipse cx="200" cy="200" rx="200" ry="64" stroke={D.fg} strokeWidth="1.2" fill="none" opacity=".7" />
          <circle cx={200 + 200 * Math.cos(frame / 14)} cy={200 + 64 * Math.sin(frame / 14)} r="6" fill={D.fg} />
        </g>
        <g transform={`rotate(${28 - frame * 0.2} 200 200)`}>
          <ellipse cx="200" cy="200" rx="64" ry="210" stroke={D.subtle} strokeWidth="1" fill="none" />
          <circle cx={200 + 64 * Math.cos(-frame / 18)} cy={200 + 210 * Math.sin(-frame / 18)} r="4" fill={D.muted} />
        </g>
      </svg>
      <Mark size={210} style={{ position: "absolute", top: 210, transform: `scale(${mark}) rotate(${(1 - mark) * -40}deg)`, opacity: mark }} />

      <div style={{ position: "absolute", top: 610, display: "flex", fontFamily: display, fontWeight: 900, fontSize: 92, letterSpacing: "0.14em" }}>
        {word.split("").map((ch, k) => {
          const s = 10 + k * 2.5;
          return (
            <span key={k} style={{ display: "inline-block", opacity: ease(frame, [s, s + 8], [0, 1]), transform: `translateY(${ease(frame, [s, s + 12], [40, 0])}px)` }}>
              {ch}
            </span>
          );
        })}
      </div>
      <div style={{ ...rise(frame, 36, 16), position: "absolute", top: 735, fontSize: 30, color: D.muted }}>Describe it. Claude builds it. You launch it.</div>

      <div style={{ ...rise(frame, 52, 16), position: "absolute", top: 820, display: "flex", gap: 18 }}>
        <div style={{ height: 76, padding: "0 34px", display: "flex", alignItems: "center", gap: 14, borderRadius: 14, background: D.fg, color: D.bg, fontFamily: display, fontWeight: 800, fontSize: 28, letterSpacing: "0.1em" }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: D.green }} />
          $AESTRODOM IS LIVE
        </div>
        <div style={{ height: 76, padding: "0 30px", display: "flex", alignItems: "center", borderRadius: 14, border: `1.5px solid ${D.fg}`, fontFamily: mono, fontSize: 28 }}>aestrodom.org</div>
      </div>
      <div style={{ ...rise(frame, 66, 12), position: "absolute", bottom: 50, fontSize: 22, fontWeight: 600, letterSpacing: "0.28em", color: D.subtle, textTransform: "uppercase" }}>
        @aestrodom_ai · CA in the post
      </div>
    </AbsoluteFill>
  );
}
