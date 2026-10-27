/** Round dial showing how much of a limit is used: a thin ink arc on a hairline track. */
export function Gauge({ used, max, label, size = 104 }: { used: number; max: number; label: string; size?: number }) {
  const pct = max > 0 ? Math.min(1, used / max) : 0;
  const r = 40;
  const arc = Math.PI * 1.5 * r; // 270° sweep
  const tone = pct >= 0.9 ? "var(--danger)" : pct >= 0.7 ? "var(--warning)" : "var(--accent)";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: ${used} of ${max}`}>
        <g transform="rotate(135 50 50)">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="3" strokeDasharray={`${arc} 999`} />
          <circle cx="50" cy="50" r={r} fill="none" stroke={tone} strokeWidth="3" strokeDasharray={`${arc * pct} 999`} />
        </g>
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-fg" style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)" }}>
          {used}
        </text>
        <text x="50" y="68" textAnchor="middle" className="fill-subtle" style={{ fontSize: 9 }}>
          of {max}
        </text>
      </svg>
      <div className="-mt-2 text-[10.5px] font-medium uppercase tracking-[0.2em] text-subtle">{label}</div>
    </div>
  );
}
