import Link from "next/link";
import { cn } from "@/lib/utils";

/** Product name, in one place. */
export const BRAND = "aestrodom";
export const BRAND_TITLE = "Aestrodom";

/** Aestrodom mark: the 3D triangle seen from above, drawn in ink (faces shaded by opacity) so it follows the theme. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("inline-block size-[22px] shrink-0 text-fg", className)}>
      <g strokeLinejoin="round" strokeWidth="2.5" fill="currentColor" stroke="currentColor">
        <path d="M32 5 L33 39 L4 57 Z" opacity="0.35" />
        <path d="M32 5 L60 57 L33 39 Z" />
        <path d="M4 57 L33 39 L60 57 Z" opacity="0.65" />
      </g>
    </svg>
  );
}

/** Wordmark: Orbitron black caps with a raised ring, as on the landing page. */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-start font-[family-name:var(--font-display)] text-[19px] font-black uppercase tracking-[0.15em] text-fg transition-opacity hover:opacity-80", className)}
    >
      {BRAND}
      <span className="-mt-0.5 ml-0.5 text-[0.45em]">˚</span>
    </Link>
  );
}

/** $AESTRODOM token symbol. */
export const TOKEN_SYMBOL = "AESTRODOM";

/** Official X (Twitter) account. */
export const X_HANDLE = "aestrodom_ai";
export const X_URL = `https://x.com/${X_HANDLE}`;

/** The X logo (lucide ships no brand marks). */
export function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" className={cn("size-4", className)}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
