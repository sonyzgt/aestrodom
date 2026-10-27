import gsap from "gsap";

/** Palette names; each maps to the CSS variable --c-{name} defined in globals.css. */
export const PALETTE = ["red", "coral", "orange", "yellow", "lime", "green", "cyan", "sky", "blue", "indigo", "purple", "magenta", "pink"] as const;
export type PaletteName = (typeof PALETTE)[number];

export const paletteVar = (name: PaletteName) => `var(--c-${name})`;

export const randomPaletteVar = () => paletteVar(PALETTE[Math.floor(Math.random() * PALETTE.length)]!);

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A letter hops, tilts and flashes a palette color, then springs back. */
export function hop(el: HTMLElement, keepColor = false) {
  if (gsap.isTweening(el) || reducedMotion()) return;
  const tl = gsap
    .timeline()
    .to(el, { yPercent: -18, rotate: gsap.utils.random(-12, 12), color: randomPaletteVar(), duration: 0.16, ease: "power2.out" })
    .to(el, { yPercent: 0, rotate: 0, duration: 0.7, ease: "elastic.out(1, 0.35)" });
  if (!keepColor) tl.set(el, { clearProps: "color" }, "+=0.5");
}
