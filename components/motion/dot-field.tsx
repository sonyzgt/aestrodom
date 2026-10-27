"use client";

import { useEffect, useRef } from "react";
import { PALETTE } from "@/components/motion/palette";

type Ripple = { x: number; y: number; t0: number; color: string };

/**
 * Canvas grid of small dots filling its positioned parent, tinted along a diagonal rainbow. Dots swell near the pointer; a click
 * (or, when idle, the page itself) sends a ripple ring across the field. Pauses off-screen; static
 * under reduced motion.
 */
export function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const section = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !section || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GAP = 26;
    const RADIUS = 160;
    let w = 0;
    let h = 0;
    let colors: string[] = [];
    let mx = -9999;
    let my = -9999;
    let lastInput = 0;
    let nextAuto = performance.now() + 1500;
    let visible = true;
    let raf = 0;
    const ripples: Ripple[] = [];

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      colors = PALETTE.map((p) => cs.getPropertyValue(`--c-${p}`).trim() || "#ff4b4b");
    };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = section.clientWidth;
      h = section.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      if (!reduce && now > nextAuto && now - lastInput > 4000) {
        ripples.push({ x: Math.random() * w, y: Math.random() * h, t0: now, color: colors[Math.floor(Math.random() * colors.length)]! });
        nextAuto = now + 2600 + Math.random() * 1800;
      }
      for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i]!.t0 > 2600) ripples.splice(i, 1);

      const cols = Math.ceil(w / GAP) + 1;
      const rows = Math.ceil(h / GAP) + 1;
      const ox = (w - (cols - 1) * GAP) / 2;
      const oy = (h - (rows - 1) * GAP) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ox + c * GAP;
          const y = oy + r * GAP;
          let size = 1.4;
          let alpha = 0.22;
          let color = colors[Math.floor(((c / cols + r / rows) / 2) * colors.length)]!;

          const d = Math.hypot(x - mx, y - my);
          if (d < RADIUS) {
            const k = 1 - d / RADIUS;
            size += 4.2 * k * k;
            alpha += 0.78 * k;
          }
          for (const rp of ripples) {
            const age = now - rp.t0;
            const front = age * 0.55;
            const gap = Math.abs(Math.hypot(x - rp.x, y - rp.y) - front);
            if (gap < 50) {
              const k = (1 - gap / 50) * (1 - age / 2600);
              size += 4.5 * k;
              alpha += 0.8 * k;
              if (k > 0.35) color = rp.color;
            }
          }

          ctx.globalAlpha = Math.min(1, alpha);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      if (visible) draw(now);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
      lastInput = performance.now();
    };
    const onLeave = () => {
      mx = -9999;
      my = -9999;
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea, [data-shape]")) return;
      const rect = section.getBoundingClientRect();
      const now = performance.now();
      lastInput = now;
      ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t0: now, color: colors[Math.floor(Math.random() * colors.length)]! });
    };

    readColors();
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(0);
    });
    ro.observe(section);
    const themeObserver = new MutationObserver(() => {
      readColors();
      if (reduce) draw(0);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    if (reduce) {
      draw(0);
      return () => {
        ro.disconnect();
        themeObserver.disconnect();
      };
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
    });
    io.observe(section);
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    section.addEventListener("pointerdown", onDown);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      section.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0" />;
}
