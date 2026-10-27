const CORNERS = { tl: "M0 11.5V0.5H11.5", tr: "M0.5 0.5H11.5V11.5", bl: "M0 0.5V11.5H11.5", br: "M0.5 11.5H11.5V0.5" };

/** L-shaped corner bracket, the frame ornament of the white design. Sized by --corner (falls back to 0.8rem). */
export function Corner({ pos, className }: { pos: keyof typeof CORNERS; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" fill="none" className={className} style={{ width: "var(--corner, 0.8rem)", height: "var(--corner, 0.8rem)" }}>
      <path d={CORNERS[pos]} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Four corner brackets around a relatively positioned box. */
export function Frame() {
  return (
    <>
      <Corner pos="tl" className="absolute left-0 top-0" />
      <Corner pos="tr" className="absolute right-0 top-0" />
      <Corner pos="bl" className="absolute bottom-0 left-0" />
      <Corner pos="br" className="absolute bottom-0 right-0" />
    </>
  );
}
