"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll choreography for the landing page. The page is server-rendered and fully readable without
 * JavaScript; this component only adds motion to elements marked with data attributes:
 *
 *   data-hero-line      headline lines (rise in on load)
 *   data-parallax       inner element of a hero line (slow parallax on scroll)
 *   data-hero-cta       hero prompt + links
 *   data-reveal         block that fades/rises in when scrolled into view
 *   data-stagger        container whose direct children reveal one after another
 *   data-count="123"    number that counts up when visible
 *   data-draw           SVG path/line/polyline that draws with scroll (scrubbed)
 *   data-bar="42"       progress bar that fills to the given percent when visible
 *
 * Everything runs inside gsap.matchMedia so users with "reduce motion" get the static page.
 */
export function LandingMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        { motion: "(prefers-reduced-motion: no-preference)" },
        (ctx) => {
          const { motion } = ctx.conditions as { motion: boolean };
          if (!motion) return;
          const q = gsap.utils.selector(root);

          // Hero: lines rise in (outer element), then drift apart as the page scrolls (inner element).
          // Intro and parallax live on different elements so the two tweens never fight over the same property.
          gsap.from(q("[data-hero-line]"), { yPercent: 60, autoAlpha: 0, duration: 1.1, ease: "power4.out", stagger: 0.12 });
          gsap.from(q("[data-hero-cta]"), { y: 24, autoAlpha: 0, duration: 0.9, ease: "power3.out", delay: 0.35 });
          q("[data-parallax]").forEach((el, i) => {
            gsap.fromTo(
              el,
              { y: 0 },
              {
                y: -40 * (i + 1),
                ease: "none",
                immediateRender: false,
                scrollTrigger: { trigger: el, start: "top 30%", end: "bottom top", scrub: true },
              },
            );
          });

          // SVG strokes draw in step with scroll.
          q("[data-draw]").forEach((el) => {
            const shape = el as unknown as SVGGeometryElement;
            const len = typeof shape.getTotalLength === "function" ? shape.getTotalLength() : 0;
            if (!len) return;
            gsap.set(shape, { strokeDasharray: len, strokeDashoffset: len });
            gsap.to(shape, {
              strokeDashoffset: 0,
              ease: "none",
              scrollTrigger: {
                trigger: shape.closest("[data-draw-root]") ?? shape,
                start: "top 85%",
                end: "center 45%",
                scrub: 0.8,
              },
            });
          });

          // Generic reveals, batched so elements entering together animate together.
          ScrollTrigger.batch(q("[data-reveal]"), {
            start: "top 88%",
            once: true,
            onEnter: (batch) => gsap.from(batch, { y: 40, autoAlpha: 0, duration: 0.9, ease: "power3.out", stagger: 0.1, overwrite: true }),
          });

          // Lists: children cascade in.
          q("[data-stagger]").forEach((list) => {
            gsap.from(list.children, {
              y: 28,
              autoAlpha: 0,
              duration: 0.7,
              ease: "power2.out",
              stagger: 0.08,
              scrollTrigger: { trigger: list, start: "top 85%", once: true },
            });
          });

          // Counters.
          q("[data-count]").forEach((el) => {
            const target = Number(el.getAttribute("data-count"));
            if (!Number.isFinite(target) || target <= 0) return;
            const state = { v: 0 };
            gsap.to(state, {
              v: target,
              duration: 1.6,
              ease: "power2.out",
              scrollTrigger: { trigger: el, start: "top 90%", once: true },
              onUpdate: () => {
                el.textContent = Math.round(state.v).toLocaleString();
              },
            });
          });

          // Progress bars.
          q("[data-bar]").forEach((el) => {
            const pct = Math.max(0, Math.min(100, Number(el.getAttribute("data-bar")) || 0));
            gsap.fromTo(el, { width: "0%" }, { width: `${pct}%`, duration: 1.4, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 92%", once: true } });
          });

        },
      );

      // Fonts and images change layout after first paint; recompute trigger positions.
      if (typeof document !== "undefined" && document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
      return () => mm.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
