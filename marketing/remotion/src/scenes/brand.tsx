import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandMark, C, Corner, Grid, Sfx, display, ease, rise, sans } from "../ui";

/** Logo mark drops in, the wordmark types itself out letter by letter, then the tagline. */
export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
  const word = "AESTRODOM";
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Sfx at={2} name="pop" volume={0.7} />
      <Sfx at={46} name="chime" volume={0.45} />
      <Grid opacity={ease(frame, [0, 30], [0, 1])} />
      <AbsoluteFill style={{ background: "radial-gradient(closest-side, rgba(255,255,255,1), rgba(255,255,255,0))" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BrandMark size={120} style={{ transform: `scale(${mark}) rotate(${(1 - mark) * -30}deg)`, opacity: mark }} />
        <div style={{ display: "flex", alignItems: "flex-start", marginTop: 40, fontFamily: display, fontWeight: 900, fontSize: 104, letterSpacing: "0.15em" }}>
          {word.split("").map((ch, i) => {
            const s = 14 + i * 3;
            return (
              <span key={i} style={{ display: "inline-block", opacity: ease(frame, [s, s + 10], [0, 1]), transform: `translateY(${ease(frame, [s, s + 14], [40, 0])}px)` }}>
                {ch}
              </span>
            );
          })}
          <span style={{ fontSize: 44, marginTop: -6, opacity: ease(frame, [46, 54], [0, 1]), transform: `scale(${ease(frame, [46, 58], [2, 1])})` }}>˚</span>
        </div>
        <div style={{ ...rise(frame, 56, 16), marginTop: 30, fontFamily: display, fontWeight: 500, fontSize: 30, letterSpacing: `${ease(frame, [56, 90], [0.6, 0.32])}em`, textTransform: "uppercase" }}>
          Build anything with AI
        </div>
        <div style={{ ...rise(frame, 72, 12), marginTop: 26, display: "flex", alignItems: "center", gap: 14, fontFamily: sans, fontSize: 18, fontWeight: 600, letterSpacing: "0.26em", color: C.subtle, textTransform: "uppercase" }}>
          <span style={{ width: 40, height: 1, background: C.ink }} />
          AI app builder · Robinhood Chain
          <span style={{ width: 40, height: 1, background: C.ink }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** The landing hero: Aestra in her suit, a spotlight finds the armour beneath, then floods the frame. */
export function Aestra() {
  const frame = useCurrentFrame();
  const r = interpolate(frame, [18, 45, 100, 138], [0, 330, 360, 1500], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(frame, [18, 50, 100], [1010, 1040, 960], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [18, 50, 100], [470, 640, 880], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const mask = `radial-gradient(circle at ${x}px ${y}px, #000 0px, #000 ${r * 0.45}px, rgba(0,0,0,0.6) ${r * 0.7}px, transparent ${r}px)`;
  const zoom = interpolate(frame, [0, 150], [1.08, 1]);
  const lines = ["Build", "Anything", "With AI"];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sfx at={88} name="swell" volume={0.6} />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Img src={staticFile("aestra-suit.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask }}>
          <Img src={staticFile("aestra-armor.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      </AbsoluteFill>

      <div style={{ position: "absolute", left: 120, top: 330 }}>
        <Corner pos="tl" size={18} style={{ opacity: ease(frame, [6, 16], [0, 1]) }} />
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 104, lineHeight: 1.05, letterSpacing: "0.08em", textTransform: "uppercase", margin: "14px 0" }}>
          {lines.map((l, i) => (
            <div key={l} style={{ overflow: "hidden" }}>
              <div style={{ transform: `translateY(${ease(frame, [8 + i * 6, 30 + i * 6], [110, 0])}%)` }}>{l}</div>
            </div>
          ))}
        </div>
        <Corner pos="bl" size={18} style={{ opacity: ease(frame, [24, 34], [0, 1]) }} />
      </div>

      <div style={{ ...rise(frame, 40, 16), position: "absolute", right: 120, bottom: 90, padding: 30, fontFamily: sans, fontSize: 20, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", lineHeight: 1.7 }}>
        <Corner pos="tl" style={{ position: "absolute", left: 0, top: 0 }} />
        <Corner pos="tr" style={{ position: "absolute", right: 0, top: 0 }} />
        <Corner pos="bl" style={{ position: "absolute", left: 0, bottom: 0 }} />
        <Corner pos="br" style={{ position: "absolute", right: 0, bottom: 0 }} />
        Describe it.
        <br />
        Live on its own domain.
      </div>
    </AbsoluteFill>
  );
}

/** Sign-off: mark, wordmark, the promise, and where to find us. */
export function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 15 } });
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Sfx at={2} name="pop" volume={0.6} />
      <Sfx at={36} name="chime" volume={0.5} />
      <Grid />
      <AbsoluteFill style={{ background: "radial-gradient(closest-side, rgba(255,255,255,1) 30%, rgba(255,255,255,0))" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BrandMark size={96} style={{ transform: `scale(${mark})` }} />
        <div style={{ ...rise(frame, 8, 30), display: "flex", alignItems: "flex-start", marginTop: 34, fontFamily: display, fontWeight: 900, fontSize: 88, letterSpacing: "0.15em" }}>
          AESTRODOM<span style={{ fontSize: 38, marginTop: -4 }}>˚</span>
        </div>
        <div style={{ ...rise(frame, 20, 16), marginTop: 26, fontFamily: sans, fontSize: 30, color: C.muted }}>Describe it. Claude builds it. Live on its own domain.</div>
        <div style={{ ...rise(frame, 34, 16), display: "flex", gap: 18, marginTop: 52 }}>
          <div style={{ height: 64, padding: "0 34px", display: "flex", alignItems: "center", borderRadius: 10, background: C.ink, color: "#fff", fontFamily: display, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em" }}>
            AESTRODOM.ORG
          </div>
          <div style={{ height: 64, padding: "0 30px", display: "flex", alignItems: "center", gap: 14, borderRadius: 10, border: `1.5px solid ${C.ink}`, fontFamily: sans, fontWeight: 600, fontSize: 24 }}>
            <XLogo /> @aestrodom_ai
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function XLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={C.ink}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
