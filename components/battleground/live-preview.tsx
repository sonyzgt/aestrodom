"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FRAME_W = 1280;
const FRAME_H = 800;

/**
 * A live, scaled-down view of a deployed app. The iframe mounts only while the card is near the
 * viewport, so a long grid doesn't run dozens of apps at once. It is sandboxed without
 * allow-same-origin and ignores pointer events: the card around it is the link.
 */
export function LivePreview({ url, name, className, eager = false }: { url: string; name: string; className?: string; eager?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [near, setNear] = useState(eager);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale((e?.contentRect.width ?? 0) / FRAME_W));
    ro.observe(el);
    const io = new IntersectionObserver(
      ([e]) => {
        const on = !!e?.isIntersecting;
        setNear(on);
        if (!on) setLoaded(false);
      },
      { rootMargin: "400px 0px" },
    );
    if (!eager) io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [eager]);

  return (
    <div ref={box} className={cn("relative aspect-[16/10] overflow-hidden bg-inset", className)}>
      <div className={cn("absolute inset-0 grid place-items-center transition-opacity duration-500", loaded ? "opacity-0" : "opacity-100")}>
        <div className="flex flex-col items-center gap-2 text-subtle">
          <span className="grid size-12 place-items-center border border-border bg-bg text-[20px] font-medium text-fg">{name.charAt(0).toUpperCase()}</span>
          <span className="text-[12px]">Loading live app…</span>
        </div>
      </div>
      {near && scale > 0 && (
        <iframe
          src={url}
          title={`${name} live preview`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          onLoad={() => setLoaded(true)}
          className={cn("pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
          style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}
