"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Plus, Settings } from "lucide-react";
import { Logo } from "@/components/brand";
import { LogoutIconButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Home", exact: true },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/battleground", label: "Battleground" },
  { href: "/pass", label: "Pass" },
  { href: "/dashboard/billing", label: "Credits" },
];

/** Workspace header: wordmark, tracked caps nav (active link underlined in ink), a create button and the account menu. */
export function TopBar({ email, name, isAdmin }: { email: string | null; name: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;
  const initial = (name || email || "A").charAt(0).toUpperCase();
  const isActive = (item: (typeof items)[number]) => ("exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href));

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-6 px-4 sm:px-6">
        <Logo href="/dashboard" className="text-[17px]" />

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "border-b py-1 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors",
                isActive(item) ? "border-fg text-fg" : "border-transparent text-subtle hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/dashboard/new" className="btn-primary flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[11.5px]">
            <Plus className="size-3.5" /> <span className="max-sm:hidden">New app</span>
          </Link>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="flex h-9 items-center gap-1.5 rounded-md border border-border pl-1 pr-2 text-muted outline-none transition-colors hover:border-border-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-fg/40">
              <span className="grid size-7 place-items-center rounded-[4px] bg-fg text-[12px] font-bold text-bg">{initial}</span>
              <ChevronDown className="size-3.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className="panel z-50 w-64 rounded-md p-1.5 text-fg">
                <div className="px-3 py-2.5">
                  {name && <div className="truncate text-[14px] font-semibold">{name}</div>}
                  <div className="truncate text-[12px] text-subtle">{email ?? "Signed in with Privy"}</div>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item asChild>
                  <Link href="/dashboard/settings" className="flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-[13px] text-muted outline-none data-[highlighted]:bg-elevated data-[highlighted]:text-fg">
                    <Settings className="size-4" /> Account & usage
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <div className="flex items-center justify-between px-2 py-1">
                  <ThemeToggle className="size-8" />
                  <LogoutIconButton />
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Small screens: the nav moves below the bar as a scrollable strip. */}
      <nav className="mx-auto flex max-w-[1320px] gap-6 overflow-x-auto px-4 pb-2 md:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 border-b py-1 text-[11px] font-medium uppercase tracking-[0.2em]",
              isActive(item) ? "border-fg text-fg" : "border-transparent text-subtle",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
