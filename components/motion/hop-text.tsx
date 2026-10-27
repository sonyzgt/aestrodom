"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { PALETTE, hop, paletteVar } from "@/components/motion/palette";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Tag = "h1" | "h2" | "h3" | "p" | "span" | "div";

/**
 * Text whose letters bounce in (on load or when scrolled into view) and hop when hovered.
 * Wrap words in *asterisks* to paint them in the accent color. With `colorful`, every letter
 * takes the next palette color. Screen readers get the plain text via aria-label.
 */
export function HopText({
  text,
  as: Component = "span",
  className,
  trigger = "scroll",
  colorful = false,
}: {
  text: string;
  as?: Tag;
  className?: string;
  trigger?: "load" | "scroll";
  colorful?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const plain = text.replace(/\*/g, "");

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const chars = gsap.utils.toArray<HTMLElement>("[data-hop]", ref.current);
        gsap.from(chars, {
          yPercent: 70,
          rotate: 14,
          autoAlpha: 0,
          duration: 0.8,
          ease: "back.out(2.2)",
          stagger: Math.min(0.03, 0.9 / chars.length),
          scrollTrigger: trigger === "scroll" ? { trigger: ref.current, start: "top 88%", once: true } : undefined,
        });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  // Split into highlighted / plain segments, then words (kept unbreakable), then letters.
  let letterIndex = 0;
  const segments = text.split("*").map((segment, i) => ({ segment, accent: i % 2 === 1 }));
  const words = segments.flatMap(({ segment, accent }) =>
    segment
      .split(/(\s+)/)
      .filter(Boolean)
      .map((w) => ({ w, accent })),
  );

  return (
    <Component ref={ref as never} aria-label={plain} className={className}>
      {words.map(({ w, accent }, wi) =>
        /^\s+$/.test(w) ? (
          " "
        ) : (
          <span key={wi} aria-hidden className={cn("inline-block whitespace-nowrap", accent && "text-heading-alt")}>
            {Array.from(w).map((c, ci) => {
              const color = colorful ? paletteVar(PALETTE[letterIndex++ % PALETTE.length]!) : undefined;
              return (
                <span
                  key={ci}
                  data-hop
                  className="inline-block cursor-default"
                  style={color ? { color } : undefined}
                  onMouseEnter={(e) => hop(e.currentTarget, colorful)}
                >
                  {c}
                </span>
              );
            })}
          </span>
        ),
      )}
    </Component>
  );
}
