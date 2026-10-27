import React from "react";
import { interpolate } from "remotion";
import { display, sans } from "./ui";

/** Palette of the generated demo app ("Arrow"): black with purple accents, as the prompt asks. */
const P = { bg: "#07060b", panel: "#121019", line: "#25212f", text: "#f5f3ff", dim: "#a1a1b5", accent: "#8b5cf6", accent2: "#c4b5fd" };

/** Section visibility, each 0..1, plus how far the "make it more cinematic" edit has landed. */
export interface SiteState {
  hero: number;
  features: number;
  tokenomics: number;
  roadmap: number;
  cinematic: number;
}

export const SITE_WIDTH = 1440;

/** The Arrow landing page Claude builds in the demo, drawn at SITE_WIDTH and scaled by the caller. */
export function ArrowSite({ s, frame }: { s: SiteState; frame: number }) {
  return (
    <div style={{ width: SITE_WIDTH, background: P.bg, color: P.text, fontFamily: sans }}>
      <Section v={s.hero}>
        <Hero cinematic={s.cinematic} frame={frame} />
      </Section>
      <Section v={s.features}>
        <Features />
      </Section>
      <Section v={s.tokenomics}>
        <Tokenomics v={s.tokenomics} />
      </Section>
      <Section v={s.roadmap}>
        <Roadmap />
      </Section>
    </div>
  );
}

/** A section fades in over a grey skeleton of itself, as if streaming in. */
function Section({ v, children }: { v: number; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ opacity: v, transform: `translateY(${(1 - v) * 16}px)` }}>{children}</div>
      {v < 1 && (
        <div style={{ position: "absolute", inset: 0, padding: 64, opacity: 1 - v, display: "flex", flexDirection: "column", gap: 18 }}>
          {[62, 88, 74, 40].map((w, i) => (
            <div key={i} style={{ width: `${w}%`, height: i === 0 ? 56 : 20, borderRadius: 8, background: "#1b1824" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function Hero({ cinematic, frame }: { cinematic: number; frame: number }) {
  const c = cinematic;
  return (
    <div style={{ position: "relative", height: 640, overflow: "hidden", padding: "0 80px" }}>
      {/* The cinematic pass: purple nebula, star field and a horizon line. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: c,
          background: `radial-gradient(60% 70% at 50% 110%, rgba(139,92,246,0.55), transparent 70%), radial-gradient(40% 40% at 80% 10%, rgba(196,181,253,0.18), transparent 70%)`,
        }}
      />
      {c > 0 &&
        Array.from({ length: 60 }, (_, i) => {
          const x = (i * 97) % SITE_WIDTH;
          const y = (i * 53) % 520;
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / 12 + i));
          return <div key={i} style={{ position: "absolute", left: x, top: y, width: 2, height: 2, borderRadius: 1, background: "#fff", opacity: c * tw * 0.8 }} />;
        })}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 120, height: 1, background: `linear-gradient(90deg, transparent, ${P.accent}, transparent)`, opacity: c }} />

      <nav style={{ position: "relative", height: 96, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: display, fontWeight: 900, fontSize: 26, letterSpacing: "0.12em" }}>
          <ArrowLogo size={34} />
          ARROW
        </div>
        <div style={{ display: "flex", gap: 40, fontSize: 17, color: P.dim }}>
          <span>Features</span>
          <span>Tokenomics</span>
          <span>Roadmap</span>
        </div>
        <div style={{ padding: "12px 22px", borderRadius: 999, background: P.accent, fontWeight: 700, fontSize: 16 }}>Buy $ARROW</div>
      </nav>

      <div style={{ position: "relative", textAlign: "center", marginTop: interpolate(c, [0, 1], [70, 40]) }}>
        <div style={{ display: "inline-block", padding: "8px 16px", borderRadius: 999, border: `1px solid ${P.line}`, color: P.accent2, fontSize: 15, letterSpacing: "0.1em" }}>
          NOW LIVE ON ROBINHOOD CHAIN
        </div>
        <div
          style={{
            fontFamily: display,
            fontWeight: 900,
            fontSize: interpolate(c, [0, 1], [72, 92]),
            lineHeight: 1.02,
            letterSpacing: "0.04em",
            marginTop: 28,
            textShadow: c > 0 ? `0 0 ${40 * c}px rgba(139,92,246,${0.7 * c})` : undefined,
          }}
        >
          THE FASTEST
          <br />
          <span style={{ color: P.accent2 }}>ARROW</span> ON-CHAIN
        </div>
        <div style={{ fontSize: 21, color: P.dim, marginTop: 26 }}>Aim once. Hit the moon. A community token with a straight trajectory.</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 36 }}>
          <div style={{ padding: "16px 30px", borderRadius: 999, background: P.accent, fontWeight: 700, fontSize: 17, boxShadow: `0 0 ${40 * c}px rgba(139,92,246,${0.6 * c})` }}>Get $ARROW</div>
          <div style={{ padding: "16px 30px", borderRadius: 999, border: `1px solid ${P.line}`, fontWeight: 600, fontSize: 17 }}>Read the plan</div>
        </div>
      </div>
    </div>
  );
}

function Features() {
  const items = [
    ["Fair launch", "No presale, no team bags. Everyone starts at the same line."],
    ["Bonding curve", "Price set by demand on Pons V2 until the token graduates."],
    ["Community first", "Holders vote on every milestone of the roadmap."],
  ];
  return (
    <div style={{ padding: "40px 80px 72px" }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, letterSpacing: "0.08em", textAlign: "center" }}>WHY ARROW</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 36 }}>
        {items.map(([t, b], i) => (
          <div key={t} style={{ padding: 30, borderRadius: 20, background: P.panel, border: `1px solid ${P.line}` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(139,92,246,${0.25 + i * 0.15})` }} />
            <div style={{ fontWeight: 700, fontSize: 22, marginTop: 22 }}>{t}</div>
            <div style={{ fontSize: 17, color: P.dim, marginTop: 10, lineHeight: 1.5 }}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tokenomics({ v }: { v: number }) {
  const parts: [string, number, string][] = [
    ["Bonding curve", 80, P.accent],
    ["Liquidity", 15, P.accent2],
    ["Community", 5, "#4c3d7a"],
  ];
  return (
    <div style={{ padding: "48px 80px 72px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
      <div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, letterSpacing: "0.08em" }}>TOKENOMICS</div>
        <div style={{ fontSize: 19, color: P.dim, marginTop: 14 }}>1,000,000,000 $ARROW · 1% curve fee</div>
      </div>
      <div>
        <div style={{ display: "flex", height: 22, borderRadius: 11, overflow: "hidden", background: P.panel }}>
          {parts.map(([k, pct, col]) => (
            <div key={k} style={{ width: `${pct * v}%`, background: col }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 18, fontSize: 16, color: P.dim }}>
          {parts.map(([k, pct, col]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: col }} />
              {k} {pct}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Roadmap() {
  const phases = ["Launch", "1,000 holders", "Graduate", "Uniswap v4"];
  return (
    <div style={{ padding: "40px 80px 96px" }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, letterSpacing: "0.08em", textAlign: "center" }}>ROADMAP</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 36 }}>
        {phases.map((p, i) => (
          <div key={p} style={{ padding: 24, borderRadius: 16, border: `1px solid ${i === 0 ? P.accent : P.line}`, background: P.panel }}>
            <div style={{ fontSize: 14, color: P.accent2, letterSpacing: "0.14em" }}>PHASE {i + 1}</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginTop: 10 }}>{p}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArrowLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill={P.accent} />
      <path d="M9 23 L22 10 M14 10 H22 V18" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
