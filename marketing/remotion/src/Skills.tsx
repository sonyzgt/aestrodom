import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { BrandMark, Button, C, Caption, Caret, Check, Corner, Cursor, Grid, Label, Sfx, Spinner, TypingSound, Window, display, ease, pressAt, rise, sans, typed } from "./ui";

/**
 * Tutorial: switching on skills (GSAP, UI UX Pro Max, Logo Design, Frontend Design, shadcn/ui,
 * Web Design Guidelines) when creating an app and later in the builder. 16:9, same light look
 * as the other guides.
 */

const SCENES: [React.FC, number][] = [
  [Title, 110],
  [Describe, 150],
  [PickSkills, 250],
  [Build, 280],
  [ChangeLater, 270],
  [AllSkills, 190],
  [End, 150],
];
const FADE = 15;
export const SKILLS_DURATION = SCENES.reduce((s, [, d]) => s + d, 0) - FADE * (SCENES.length - 1);

export function SkillsGuide() {
  const starts = SCENES.map((_, i) => SCENES.slice(0, i).reduce((s, [, d]) => s + d, 0) - FADE * i);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Html5Audio
        src={staticFile("sfx/music.wav")}
        volume={(f) => 0.38 * interpolate(f, [SKILLS_DURATION - 60, SKILLS_DURATION], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
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
/* Data and layout                                                     */
/* ------------------------------------------------------------------ */

const SKILLS = [
  { name: "GSAP", desc: "Scroll-driven, timeline and text animations." },
  { name: "UI UX Pro Max", desc: "A full design system: style, palette, type, states." },
  { name: "Logo Design", desc: "A custom SVG logo, favicon and brand mark." },
  { name: "Frontend Design", desc: "Bold, memorable interfaces, not generic layouts." },
  { name: "shadcn/ui", desc: "Accessible components in the shadcn/ui style." },
  { name: "Web Design Guidelines", desc: "Checks a11y, performance and UX best practices." },
];

const WX = 120;
const WY = 210;
/** Content area of the window (below the 52px address bar), in composition pixels. */
const BX = WX;
const BY = WY + 52;
const WIN_W = 1680;
const toScreen = (x: number, y: number): [number, number] => [BX + x, BY + y];

const PROMPT = "A launch site for Ember Roast, a coffee brand, with smooth scroll animations";

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

function SparkIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

/** The "Skills" trigger as on the site. */
function SkillsButton({ count, pressed = 0, w = 124 }: { count: number; pressed?: number; w?: number }) {
  return (
    <div
      style={{
        width: w,
        height: 36,
        borderRadius: 8,
        border: `1.5px solid ${count ? C.ink : C.line}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 15,
        fontWeight: 600,
        color: count ? C.ink : C.muted,
        transform: `scale(${1 - pressed * 0.05})`,
        background: C.bg,
      }}
    >
      <SparkIcon />
      Skills{count > 0 && <span style={{ fontVariantNumeric: "tabular-nums" }}>· {count}</span>}
    </div>
  );
}

const ITEM_H = 58;
const MENU_HEAD = 44;

/** The checklist dropdown. `checkedAt[i]` is the frame skill i gets checked (Infinity = never; -1 = already). */
function SkillsMenu({ x, y, frame, openAt, closeAt, checkedAt }: { x: number; y: number; frame: number; openAt: number; closeAt: number; checkedAt: number[] }) {
  if (frame < openAt || frame >= closeAt + 8) return null;
  const o = frame < closeAt ? ease(frame, [openAt, openAt + 8], [0, 1]) : ease(frame, [closeAt, closeAt + 8], [1, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + (1 - o) * 10,
        width: 440,
        padding: 8,
        borderRadius: 12,
        background: C.bg,
        border: `1px solid ${C.line}`,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,.35)",
        opacity: o,
        zIndex: 5,
      }}
    >
      <div style={{ height: MENU_HEAD - 8, display: "flex", alignItems: "center", padding: "0 12px" }}>
        <Label style={{ fontSize: 12 }}>Skills for Claude</Label>
      </div>
      {SKILLS.map((s, i) => {
        const on = frame >= checkedAt[i]!;
        const pop = checkedAt[i]! >= 0 && Number.isFinite(checkedAt[i]) ? pressAt(frame, checkedAt[i]!) : 0;
        return (
          <div key={s.name} style={{ height: ITEM_H, display: "flex", alignItems: "center", gap: 14, padding: "0 12px", borderRadius: 8, background: on && frame < checkedAt[i]! + 20 ? C.soft : "transparent" }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${on ? C.ink : "#d1d5db"}`, background: on ? C.ink : C.bg, display: "grid", placeItems: "center", transform: `scale(${1 + pop * 0.2})`, flexShrink: 0 }}>
              {on && <Check size={14} color="#fff" />}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 13.5, color: C.subtle, marginTop: 2 }}>{s.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
const menuItemCenter = (menuX: number, menuY: number, i: number): [number, number] => toScreen(menuX + 140, menuY + 8 + MENU_HEAD - 8 + ITEM_H * i + ITEM_H / 2);

/* ---------- New-project form ---------- */

const FORM_X = 240;
const FORM_W = 1200;
const BOX_Y = 146;
const BOX_H = 206;
const FOOT_Y = BOX_Y + BOX_H - 56;
const SKILLS_BTN: [number, number] = [FORM_X + 18, FOOT_Y + 10];
const BUILD_Y = BOX_Y + BOX_H + 20;

function NewProject({ text, caret, count, skillsPressed = 0, buildPressed = 0, children }: { text: string; caret?: boolean; count: number; skillsPressed?: number; buildPressed?: number; children?: React.ReactNode }) {
  return (
    <>
      <AppBar active="Projects" />
      <div style={{ position: "absolute", left: FORM_X, top: 86, fontFamily: display, fontWeight: 800, fontSize: 34, letterSpacing: "0.06em", textTransform: "uppercase" }}>New app</div>
      <div style={{ position: "absolute", left: FORM_X, top: BOX_Y, width: FORM_W, height: BOX_H, borderRadius: 18, border: `1.5px solid ${caret ? C.ink : C.line}`, background: C.inset }}>
        <div style={{ padding: "24px 28px", fontSize: 24, lineHeight: 1.5, color: text ? C.ink : C.faint }}>
          {text || "What should it do, who is it for, and how should it feel?"}
          {caret && <Caret />}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: BOX_H - 56, height: 56, borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 24px", fontSize: 14, color: C.subtle }}>
          {text.length} / 8,000 · Ctrl + Enter to build
        </div>
      </div>
      <div style={{ position: "absolute", left: SKILLS_BTN[0], top: SKILLS_BTN[1] }}>
        <SkillsButton count={count} pressed={skillsPressed} />
      </div>
      <div style={{ position: "absolute", left: FORM_X, top: BUILD_Y, width: FORM_W, display: "flex", gap: 16 }}>
        <div style={{ width: 360, height: 60, borderRadius: 12, border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 18px", fontSize: 18, color: C.faint }}>App name (optional)</div>
        <Button pressed={buildPressed} style={{ flex: 1, height: 60 }}>
          Build my app →
        </Button>
      </div>
      {children}
    </>
  );
}

/* ---------- The generated site in the preview ---------- */

const EMBER = { bg: "#120c08", card: "#1d140e", ink: "#f6ede4", muted: "#bfa996", accent: "#f2994a" };

function EmberLogo({ size = 30, draw = 1 }: { size?: number; draw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke={EMBER.accent} strokeWidth="2.5" strokeDasharray="88" strokeDashoffset={88 * (1 - draw)} />
      <path d="M16 7c4 5 5 8 2.5 11.5-1 1.4-1 3 .5 4.5-4 0-7-2.6-7-6.5 0-3.4 2.4-5.4 4-9.5z" fill={EMBER.accent} opacity={draw} />
    </svg>
  );
}

/** Words rise in one by one, the way the GSAP SplitText reveal looks. */
function Reveal({ text, frame, at, size, color = EMBER.ink }: { text: string; frame: number; at: number; size: number; color?: string }) {
  return (
    <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.05, color, letterSpacing: "-0.01em" }}>
      {text.split(" ").map((w, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", marginRight: size * 0.25 }}>
          <span style={{ display: "inline-block", transform: `translateY(${ease(frame, [at + i * 4, at + i * 4 + 16], [105, 0])}%)` }}>{w}</span>
        </span>
      ))}
    </div>
  );
}

function EmberSite({ frame, at, scroll = 0, logo = 1, pricing }: { frame: number; at: number; scroll?: number; logo?: number; pricing?: { at: number; dialogAt?: number } }) {
  const shown = frame >= at;
  return (
    <div style={{ position: "absolute", inset: 0, background: EMBER.bg, color: EMBER.ink, fontFamily: sans, overflow: "hidden", opacity: shown ? ease(frame, [at, at + 10], [0, 1]) : 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 400px at 80% 10%, rgba(242,153,74,.28), transparent 70%), radial-gradient(500px 300px at 0% 100%, rgba(242,153,74,.12), transparent 70%)" }} />
      <div style={{ position: "relative", transform: `translateY(${-scroll}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "26px 40px" }}>
          <EmberLogo draw={logo} />
          <span style={{ fontWeight: 800, letterSpacing: "0.2em", fontSize: 17, opacity: logo }}>EMBER ROAST</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 26, fontSize: 14, color: EMBER.muted }}>
            <span>Beans</span>
            <span>Story</span>
            <span>Pricing</span>
          </div>
        </div>
        <div style={{ padding: "50px 40px 0" }}>
          <div style={{ fontSize: 14, letterSpacing: "0.3em", color: EMBER.accent, opacity: ease(frame, [at + 8, at + 20], [0, 1]) }}>SMALL BATCH · ROASTED WEEKLY</div>
          <div style={{ marginTop: 18 }}>
            <Reveal text="Coffee that" frame={frame} at={at + 12} size={78} />
            <Reveal text="burns slow." frame={frame} at={at + 22} size={78} color={EMBER.accent} />
          </div>
          <div style={{ marginTop: 22, fontSize: 19, color: EMBER.muted, maxWidth: 520, opacity: ease(frame, [at + 40, at + 56], [0, 1]) }}>Single-origin beans roasted over oak, shipped within 48 hours of the fire.</div>
          <div style={{ marginTop: 28, display: "flex", gap: 14, opacity: ease(frame, [at + 48, at + 62], [0, 1]) }}>
            <div style={{ padding: "14px 24px", borderRadius: 999, background: EMBER.accent, color: EMBER.bg, fontWeight: 700 }}>Shop the roast</div>
            <div style={{ padding: "14px 24px", borderRadius: 999, border: `1px solid ${EMBER.muted}55`, fontWeight: 600 }}>Our story</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, padding: "70px 40px 0" }}>
          {["Ethiopia Guji", "Colombia Huila", "Sumatra Gayo"].map((n, i) => {
            const t = at + 70 + i * 8;
            return (
              <div key={n} style={{ flex: 1, height: 200, borderRadius: 18, background: EMBER.card, border: `1px solid ${EMBER.muted}22`, padding: 22, transform: `translateY(${ease(frame, [t, t + 20], [60, 0])}px)`, opacity: ease(frame, [t, t + 14], [0, 1]) }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: `radial-gradient(circle at 35% 35%, ${EMBER.accent}, #6b3410)` }} />
                <div style={{ marginTop: 18, fontSize: 20, fontWeight: 700 }}>{n}</div>
                <div style={{ marginTop: 6, fontSize: 14, color: EMBER.muted }}>Notes of {["jasmine and peach", "cocoa and red apple", "cedar and dark chocolate"][i]}.</div>
              </div>
            );
          })}
        </div>
        {pricing && (
          <div style={{ padding: "70px 40px 0" }}>
            <div style={{ fontSize: 34, fontWeight: 800, opacity: ease(frame, [pricing.at, pricing.at + 12], [0, 1]) }}>Pick your plan</div>
            <div style={{ display: "flex", gap: 18, marginTop: 22 }}>
              {[
                ["Taster", "$14", "1 bag a month"],
                ["Regular", "$26", "2 bags a month"],
                ["Roaster", "$48", "4 bags a month"],
              ].map(([n, p, d], i) => {
                const t = pricing.at + 6 + i * 6;
                return (
                  <div key={n} style={{ flex: 1, borderRadius: 14, background: i === 1 ? EMBER.ink : EMBER.card, color: i === 1 ? EMBER.bg : EMBER.ink, padding: 22, border: `1px solid ${EMBER.muted}33`, transform: `translateY(${ease(frame, [t, t + 16], [40, 0])}px)`, opacity: ease(frame, [t, t + 12], [0, 1]) }}>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.1em" }}>{n?.toUpperCase()}</div>
                    <div style={{ marginTop: 10, fontSize: 38, fontWeight: 800 }}>
                      {p}
                      <span style={{ fontSize: 15, fontWeight: 500, opacity: 0.6 }}>/mo</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 14, opacity: 0.7 }}>{d}</div>
                    <div style={{ marginTop: 16, height: 40, borderRadius: 8, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, background: i === 1 ? EMBER.accent : "transparent", border: i === 1 ? "none" : `1px solid ${EMBER.muted}55`, color: i === 1 ? EMBER.bg : EMBER.ink }}>Choose {n}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {pricing?.dialogAt !== undefined && frame >= pricing.dialogAt && (
        <AbsoluteFill style={{ background: `rgba(0,0,0,${ease(frame, [pricing.dialogAt, pricing.dialogAt + 10], [0, 0.55])})`, alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 420, padding: 26, borderRadius: 16, background: EMBER.card, border: `1px solid ${EMBER.muted}33`, transform: `scale(${ease(frame, [pricing.dialogAt, pricing.dialogAt + 12], [0.94, 1])})`, opacity: ease(frame, [pricing.dialogAt, pricing.dialogAt + 10], [0, 1]) }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Regular plan</div>
            <div style={{ marginTop: 8, fontSize: 15, color: EMBER.muted }}>Two fresh bags every month. Pause or cancel anytime.</div>
            <div style={{ marginTop: 18, height: 44, borderRadius: 8, border: `1px solid ${EMBER.muted}44`, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 15, color: EMBER.muted }}>you@example.com</div>
            <div style={{ marginTop: 12, height: 44, borderRadius: 8, background: EMBER.accent, color: EMBER.bg, display: "grid", placeItems: "center", fontWeight: 700 }}>Start subscription</div>
          </div>
        </AbsoluteFill>
      )}
    </div>
  );
}

/* ---------- Builder ---------- */

const CHAT_W = 600;
/** Inside the chat column, which starts below the 64px app bar. */
const COMPOSER_Y = 768 - 64 - 146;
const COMPOSER_H = 126;
const B_SKILLS: [number, number] = [40, COMPOSER_Y + COMPOSER_H - 52];
const B_SEND: [number, number] = [CHAT_W - 40 - 40, COMPOSER_Y + COMPOSER_H - 52];

function Chips({ names, frame, at }: { names: string[]; frame: number; at: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
      {names.map((n, i) => (
        <span key={n} style={{ ...rise(frame, at + i * 3, 8, 10), display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.line}`, background: C.inset, fontSize: 13.5, fontWeight: 600 }}>
          <SparkIcon size={12} /> {n}
        </span>
      ))}
    </div>
  );
}

function Steps({ frame, steps }: { frame: number; steps: (readonly [string, number])[] }) {
  return (
    <div style={{ marginTop: 18 }}>
      {steps.map(([t, at], i) =>
        frame >= at ? (
          <div key={t} style={{ ...rise(frame, at, 10, 8), display: "flex", alignItems: "center", gap: 12, padding: "8px 0", fontSize: 15.5, fontFamily: i < steps.length - 1 ? "ui-monospace, Consolas, monospace" : sans, fontWeight: i === steps.length - 1 ? 700 : 400, color: i === steps.length - 1 ? C.success : C.ink }}>
            <Check size={15} color={i === steps.length - 1 ? C.success : C.ink} /> {t}
          </div>
        ) : null,
      )}
    </div>
  );
}

function Composer({ text, caret, count, skillsPressed = 0, sendPressed = 0 }: { text: string; caret?: boolean; count: number; skillsPressed?: number; sendPressed?: number }) {
  return (
    <div style={{ position: "absolute", left: 24, top: COMPOSER_Y, width: CHAT_W - 48, height: COMPOSER_H, borderRadius: 12, border: `1.5px solid ${caret ? C.ink : C.line}`, background: C.bg }}>
      <div style={{ padding: "14px 16px", fontSize: 16.5, lineHeight: 1.45, color: text ? C.ink : C.faint, height: 70, overflow: "hidden" }}>
        {text || "Ask Claude to change anything…"}
        {caret && <Caret />}
      </div>
      <div style={{ position: "absolute", left: B_SKILLS[0] - 24, top: B_SKILLS[1] - COMPOSER_Y }}>
        <SkillsButton count={count} pressed={skillsPressed} />
      </div>
      <div style={{ position: "absolute", left: B_SEND[0] - 24, top: B_SEND[1] - COMPOSER_Y, width: 40, height: 36, borderRadius: 8, background: text ? C.ink : "#d1d5db", color: "#fff", display: "grid", placeItems: "center", transform: `scale(${1 - sendPressed * 0.08})` }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </div>
    </div>
  );
}

function BuilderFrame({ children, preview }: { children: React.ReactNode; preview: React.ReactNode }) {
  return (
    <>
      <AppBar active="Projects" />
      <div style={{ position: "absolute", left: 0, top: 64, width: CHAT_W, bottom: 0, borderRight: `1px solid ${C.line}` }}>
        <div style={{ position: "absolute", inset: 0, top: 0 }}>{children}</div>
      </div>
      <div style={{ position: "absolute", left: CHAT_W, top: 64, right: 0, bottom: 0, background: C.inset, padding: 24 }}>
        <div style={{ position: "relative", height: "100%", borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}`, background: C.soft }}>{preview}</div>
      </div>
    </>
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
          Skills
          <br />
          <span style={{ color: C.faint }}>for Claude</span>
        </div>
        <div style={{ ...rise(frame, 34, 16), marginTop: 30, fontSize: 26, color: C.muted }}>Check a skill and Claude builds with it. GSAP, shadcn/ui, logos and more.</div>
      </div>
    </AbsoluteFill>
  );
}

/** 01: describe the app. */
function Describe() {
  const frame = useCurrentFrame();
  const start = 22;
  const cps = 34;
  const text = typed(PROMPT, frame, start, cps);
  return (
    <Stage>
      <Caption step="01" title="Describe your app" sub="Open New app in your dashboard and write what you want, in plain words." />
      <TypingSound text={PROMPT} start={start} cps={cps} />
      <Window url="aestrodom.org/dashboard/new" style={enter(frame)}>
        <NewProject text={text} caret count={0} />
      </Window>
    </Stage>
  );
}

/** 02: open Skills and check the ones you want. */
function PickSkills() {
  const frame = useCurrentFrame();
  const open = 34;
  const checks = [86, 130, 174];
  const close = 214;
  const menuX = SKILLS_BTN[0];
  const menuY = SKILLS_BTN[1] + 46;
  const btn = toScreen(SKILLS_BTN[0] + 62, SKILLS_BTN[1] + 18);
  const items = [0, 1, 2].map((i) => menuItemCenter(menuX, menuY, i));
  const count = checks.filter((c) => frame >= c).length;
  const outside = toScreen(1300, 60);
  return (
    <Stage>
      <Caption step="02" title="Turn on skills" sub="Click Skills and check what Claude should use. Here: GSAP, UI UX Pro Max and Logo Design." />
      <Window url="aestrodom.org/dashboard/new" style={{ left: WX, top: WY }}>
        <NewProject text={PROMPT} count={count} skillsPressed={pressAt(frame, open)}>
          <SkillsMenu x={menuX} y={menuY} frame={frame} openAt={open + 2} closeAt={close} checkedAt={[checks[0]!, checks[1]!, checks[2]!, Infinity, Infinity, Infinity]} />
        </NewProject>
      </Window>
      {checks.map((c) => (
        <Sfx key={c} at={c + 2} name="tick" volume={0.5} />
      ))}
      <Cursor
        start={0}
        points={[
          [0, 1100, 760],
          [26, btn[0], btn[1]],
          [50, btn[0], btn[1]],
          [78, items[0]![0], items[0]![1]],
          [96, items[0]![0], items[0]![1]],
          [122, items[1]![0], items[1]![1]],
          [140, items[1]![0], items[1]![1]],
          [166, items[2]![0], items[2]![1]],
          [186, items[2]![0], items[2]![1]],
          [208, outside[0], outside[1]],
          [250, outside[0], outside[1]],
        ]}
        clicks={[open, ...checks, close]}
      />
    </Stage>
  );
}

/** 03: build; the skills ride along and shape the result. */
function Build() {
  const frame = useCurrentFrame();
  const press = 26;
  const swap = 40;
  const steps = [
    ["Created src/components/Logo.tsx", swap + 40],
    ["Created src/components/Hero.tsx", swap + 58],
    ["Created src/lib/motion.ts", swap + 76],
    ["Edited src/index.css", swap + 92],
    ["Build passed", swap + 110],
  ] as const;
  const siteAt = swap + 114;
  const scroll = ease(frame, [siteAt + 70, siteAt + 110], [0, 120]);
  const build = toScreen(FORM_X + 376 + (FORM_W - 376) / 2, BUILD_Y + 30);
  return (
    <Stage>
      <Caption step="03" title="Build" sub="Claude follows every skill you checked: GSAP motion, a full design system and a custom logo." />
      {steps.map(([t, at]) => (
        <Sfx key={t} at={at} name="tick" volume={0.45} />
      ))}
      <Sfx at={siteAt} name="chime" volume={0.5} />
      <Window url={frame < swap ? "aestrodom.org/dashboard/new" : "aestrodom.org/project/ember-roast"} style={{ left: WX, top: WY }}>
        {frame < swap ? (
          <NewProject text={PROMPT} count={3} buildPressed={pressAt(frame, press)} />
        ) : (
          <div style={{ position: "absolute", inset: 0, opacity: ease(frame, [swap, swap + 10], [0, 1]) }}>
            <BuilderFrame preview={<><PreviewWaiting frame={frame} until={siteAt} /><EmberSite frame={frame} at={siteAt} scroll={scroll} logo={ease(frame, [siteAt, siteAt + 30], [0, 1])} /></>}>
              <div style={{ padding: 28 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div style={{ maxWidth: 470, padding: "12px 16px", borderRadius: 14, background: C.ink, color: "#fff", fontSize: 16, lineHeight: 1.45 }}>{PROMPT}</div>
                  <Chips names={["GSAP", "UI UX Pro Max", "Logo Design"]} frame={frame} at={swap + 8} />
                </div>
                <Steps frame={frame} steps={[...steps]} />
                {frame >= siteAt + 12 && (
                  <div style={{ ...rise(frame, siteAt + 12, 10, 10), marginTop: 12, fontSize: 16, lineHeight: 1.5, color: C.muted }}>
                    Built the Ember Roast launch site with a GSAP headline reveal, scroll-in cards and a new logo.
                  </div>
                )}
              </div>
              <Composer text="" count={3} />
            </BuilderFrame>
          </div>
        )}
      </Window>
      <Cursor start={0} points={[[0, 1500, 950], [20, build[0], build[1]], [60, build[0], build[1]], [110, 1500, 1000]]} clicks={[press]} />
    </Stage>
  );
}

function PreviewWaiting({ frame, until }: { frame: number; until: number }) {
  if (frame >= until + 10) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 14, color: C.subtle, fontSize: 17, flexDirection: "row" }}>
      <Spinner /> Building your app…
    </AbsoluteFill>
  );
}

/** 04: change skills any time from the builder. */
function ChangeLater() {
  const frame = useCurrentFrame();
  const open = 30;
  const check = 80;
  const close = 108;
  const typeAt = 122;
  const cps = 40;
  const prompt = "Add a pricing section with a dialog for each plan";
  const send = typeAt + Math.ceil((prompt.length / cps) * 30) + 8;
  const sent = frame >= send;
  const menuX = B_SKILLS[0];
  const menuY = 64 + B_SKILLS[1] - 8 - (MENU_HEAD + ITEM_H * SKILLS.length + 8);
  const btn = toScreen(B_SKILLS[0] + 62, 64 + B_SKILLS[1] + 18);
  const item = menuItemCenter(menuX, menuY, 4);
  const sendPt = toScreen(B_SEND[0] + 20, 64 + B_SEND[1] + 18);
  const stepsAt = send + 16;
  const steps = [
    ["Created src/components/ui/dialog.tsx", stepsAt],
    ["Created src/components/Pricing.tsx", stepsAt + 14],
    ["Build passed", stepsAt + 30],
  ] as const;
  const pricingAt = stepsAt + 32;
  const count = frame >= check ? 4 : 3;
  return (
    <Stage>
      <Caption step="04" title="Change skills any time" sub="The Skills button is in the builder too. Checked skills stay on for every request in the project." />
      <TypingSound text={prompt} start={typeAt} cps={cps} />
      <Sfx at={check + 2} name="tick" volume={0.5} />
      <Sfx at={pricingAt} name="pop" volume={0.5} />
      <Window url="aestrodom.org/project/ember-roast" style={enter(frame)}>
        <BuilderFrame
          preview={<EmberSite frame={frame + 400} at={0} scroll={frame >= pricingAt ? ease(frame, [pricingAt, pricingAt + 30], [120, 400]) : 120} pricing={{ at: pricingAt + 400 + 6, dialogAt: pricingAt + 400 + 34 }} />}
        >
          <div style={{ padding: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ maxWidth: 470, padding: "12px 16px", borderRadius: 14, background: C.ink, color: "#fff", fontSize: 16, lineHeight: 1.45, opacity: sent ? 0.35 : 1 }}>{PROMPT}</div>
              {sent && (
                <div style={{ ...rise(frame, send, 10, 10), display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: 16 }}>
                  <div style={{ maxWidth: 470, padding: "12px 16px", borderRadius: 14, background: C.ink, color: "#fff", fontSize: 16, lineHeight: 1.45 }}>{prompt}</div>
                  <Chips names={["GSAP", "UI UX Pro Max", "Logo Design", "shadcn/ui"]} frame={frame} at={send + 4} />
                </div>
              )}
            </div>
            {sent && <Steps frame={frame} steps={[...steps]} />}
          </div>
          <Composer text={sent ? "" : typed(prompt, frame, typeAt, cps)} caret={!sent && frame >= typeAt} count={count} skillsPressed={pressAt(frame, open)} sendPressed={pressAt(frame, send)} />
          <SkillsMenu x={menuX} y={menuY - 64} frame={frame} openAt={open + 2} closeAt={close} checkedAt={[-1, -1, -1, Infinity, check, Infinity]} />
        </BuilderFrame>
      </Window>
      <Cursor
        start={0}
        points={[
          [0, 900, 700],
          [22, btn[0], btn[1]],
          [44, btn[0], btn[1]],
          [72, item[0], item[1]],
          [90, item[0], item[1]],
          [104, 900, 500],
          [120, 900, 500],
          [send - 18, sendPt[0], sendPt[1]],
          [send + 30, sendPt[0], sendPt[1]],
          [send + 70, 1000, 1000],
        ]}
        clicks={[open, check, close, send]}
      />
    </Stage>
  );
}

/** 05: the six skills. */
function AllSkills() {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Caption step="05" title="Six skills, one click each" sub="Mix them freely. Claude adds each checked skill to how it plans, designs and codes." />
      <div style={{ position: "absolute", left: 120, top: 250, width: 1680, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {SKILLS.map((s, i) => (
          <div key={s.name} style={{ ...rise(frame, 14 + i * 6, 24), position: "relative", height: 300, borderRadius: 20, border: `1px solid ${C.line}`, background: C.bg, padding: 34, boxShadow: "0 20px 40px -28px rgba(15,23,42,.35)" }}>
            <Corner pos="tl" style={{ position: "absolute", left: 14, top: 14 }} />
            <Corner pos="br" style={{ position: "absolute", right: 14, bottom: 14 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, color: C.faint, fontWeight: 700, letterSpacing: "0.2em" }}>0{i + 1}</div>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: frame >= 40 + i * 10 ? C.ink : C.bg, border: `1.5px solid ${C.ink}`, display: "grid", placeItems: "center" }}>{frame >= 40 + i * 10 && <Check size={18} color="#fff" />}</div>
            </div>
            <div style={{ marginTop: 56, fontFamily: display, fontWeight: 800, fontSize: 34, letterSpacing: "0.04em" }}>{s.name}</div>
            <div style={{ marginTop: 14, fontSize: 21, color: C.muted, lineHeight: 1.4 }}>{s.desc}</div>
          </div>
        ))}
      </div>
      {SKILLS.map((s, i) => (
        <Sfx key={s.name} at={40 + i * 10} name="tick" volume={0.35} />
      ))}
    </Stage>
  );
}

function End() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 15 } });
  const steps = ["Describe your app", "Click Skills", "Check what you need", "Build"];
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
          <div style={{ height: 64, padding: "0 30px", display: "flex", alignItems: "center", borderRadius: 10, background: C.ink, color: "#fff", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: "0.1em" }}>AESTRODOM.ORG</div>
          <div style={{ height: 64, padding: "0 26px", display: "flex", alignItems: "center", borderRadius: 10, border: `1.5px solid ${C.ink}`, fontWeight: 600, fontSize: 22 }}>@aestrodom_ai</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
