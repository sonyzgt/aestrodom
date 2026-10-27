"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo, XLogo, X_HANDLE, X_URL } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/#workflow", label: "Workflow" },
  { href: "/#features", label: "Features" },
  { href: "/#token", label: "Tokens" },
  { href: "/battleground", label: "Battleground" },
  { href: "/pass", label: "Pass" },
  { href: "/#faq", label: "FAQ" },
];

/** Flat top bar: hairline bottom border, mono nav links that turn red on hover. */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Logo className="text-[16px] sm:text-[19px]" />
        <nav className="hidden items-center gap-1 font-mono text-[13px] uppercase tracking-[0.06em] text-muted lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-1.5 transition-colors hover:text-red">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Aestrodom on X"
            title={`@${X_HANDLE} on X`}
            className="hidden size-9 place-items-center rounded-sm text-muted transition-colors hover:bg-elevated hover:text-fg sm:grid"
          >
            <XLogo />
          </a>
          {/* Below sm the theme toggle lives in the menu so the bar fits a 360px phone. */}
          <ThemeToggle className="border-transparent max-sm:hidden" />
          <Link href={signedIn ? "/dashboard" : "/login"} className="btn-primary flex h-9 items-center gap-2 whitespace-nowrap rounded-sm px-3 text-[13px] sm:px-3.5 sm:text-[14px]">
            {signedIn ? "Dashboard" : "Get started"} <ArrowRight className="size-3.5 max-sm:hidden" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-sm text-muted hover:text-fg lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="flex w-full flex-col border-t border-border px-3 py-2 font-mono text-[14px] uppercase lg:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-sm px-4 py-3 text-muted hover:bg-elevated hover:text-red">
              {n.label}
            </Link>
          ))}
          <div className="flex items-center justify-between border-t border-border px-4 pt-2 sm:hidden">
            <a href={X_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 text-muted hover:text-fg">
              <XLogo /> @{X_HANDLE}
            </a>
            <ThemeToggle className="border-transparent" />
          </div>
        </nav>
      )}
    </header>
  );
}
