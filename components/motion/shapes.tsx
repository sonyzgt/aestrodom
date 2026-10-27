"use client";

import { useRef } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { paletteVar, type PaletteName } from "@/components/motion/palette";

gsap.registerPlugin(useGSAP, Draggable, ScrollTrigger);

export type ShapeKind = "circle" | "square" | "triangle" | "ring" | "plus" | "zigzag" | "half" | "diamond";

export type ShapeSpec = {
  kind: ShapeKind;
  color: PaletteName;
  /** Tailwind position classes, e.g. "right-[8%] top-[12%] max-md:hidden". */
  pos: string;
  /** How far (px) the shape leans away from the pointer; negative leans toward it. */
  depth: number;
  /** Tailwind size class; defaults to the hero size. */
  size?: string;
};

const SPINNERS: ShapeKind[] = ["square", "plus", "diamond"];

function ShapeSvg({ kind, color }: { kind: ShapeKind; color: string }) {
  switch (kind) {
    case "circle":
      return <circle cx="30" cy="30" r="30" fill={color} />;
    case "square":
      return <rect x="6" y="6" width="48" height="48" rx="6" fill={color} />;
    case "triangle":
      return <polygon points="30,4 57,54 3,54" fill={color} />;
    case "ring":
      return <circle cx="30" cy="30" r="22" fill="none" stroke={color} strokeWidth="9" />;
    case "plus":
      return <path d="M23 4h14v19h19v14H37v19H23V37H4V23h19z" fill={color} />;
    case "zigzag":
      return <polyline points="2,40 14,18 26,40 38,18 50,40 58,26" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />;
    case "half":
      return <path d="M4 44a26 26 0 0 1 52 0z" fill={color} />;
    case "diamond":
      return <rect x="14" y="14" width="32" height="32" rx="3" fill="none" stroke={color} strokeWidth="7" transform="rotate(45 30 30)" />;
  }
}

/**
 * Colored geometric shapes scattered over a positioned parent. They pop in (on load or when scrolled
 * into view), idle (bob or spin), lean away from the pointer, and can be dragged around the parent.
 * Each shape has three nested elements so drag, pointer lean and idle motion never share a transform.
 */
export function FloatingShapes({ shapes, trigger = "scroll", className }: { shapes: ShapeSpec[]; trigger?: "load" | "scroll"; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        gsap.from(q("[data-shape-in]"), {
          scale: 0,
          rotate: -120,
          duration: 1.2,
          ease: "elastic.out(1, 0.5)",
          stagger: 0.08,
          delay: trigger === "load" ? 0.3 : 0,
          scrollTrigger: trigger === "scroll" ? { trigger: root.current, start: "top 80%", once: true } : undefined,
        });

        q("[data-shape-in]").forEach((el) => {
          if (el.hasAttribute("data-spin")) {
            gsap.to(el, { rotate: "+=360", duration: gsap.utils.random(10, 18), ease: "none", repeat: -1 });
          } else {
            gsap.to(el, {
              y: gsap.utils.random(-22, 22),
              rotate: gsap.utils.random(-28, 28),
              duration: gsap.utils.random(2.4, 4),
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
            });
          }
        });

        const movers = q("[data-shape-depth]").map((el) => ({
          depth: Number(el.getAttribute("data-shape-depth")) || 0,
          x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }),
          y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" }),
        }));
        const onMove = (e: PointerEvent) => {
          const nx = e.clientX / window.innerWidth - 0.5;
          const ny = e.clientY / window.innerHeight - 0.5;
          for (const m of movers) {
            m.x(nx * m.depth);
            m.y(ny * m.depth);
          }
        };
        window.addEventListener("pointermove", onMove, { passive: true });

        const drags = Draggable.create(q("[data-shape]"), {
          bounds: root.current,
          onPress() {
            gsap.to(this.target, { scale: 1.2, duration: 0.2, ease: "power2.out" });
          },
          onRelease() {
            gsap.to(this.target, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
          },
        });

        return () => {
          window.removeEventListener("pointermove", onMove);
          drags.forEach((d) => d.kill());
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={cn("pointer-events-none absolute inset-0", className)}>
      {shapes.map((s, i) => (
        <div key={i} data-shape className={`pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing ${s.pos}`}>
          <div data-shape-depth={s.depth}>
            <svg
              data-shape-in
              data-spin={SPINNERS.includes(s.kind) ? "" : undefined}
              viewBox="0 0 60 60"
              className={cn("block", s.size ?? "size-[clamp(34px,4.6vw,64px)]")}
              aria-hidden
            >
              <ShapeSvg kind={s.kind} color={paletteVar(s.color)} />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
