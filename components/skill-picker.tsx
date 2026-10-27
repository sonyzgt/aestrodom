"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Sparkles } from "lucide-react";
import { SKILLS, type SkillId } from "@/lib/skills";
import { cn } from "@/lib/utils";

/** "Skills" button with a checklist; checked skills are added to Claude's instructions. */
export function SkillPicker({ value, onChange, disabled, className }: { value: SkillId[]; onChange: (next: SkillId[]) => void; disabled?: boolean; className?: string }) {
  const toggle = (id: SkillId) => onChange(SKILLS.map((s) => s.id).filter((s) => (s === id ? !value.includes(s) : value.includes(s))));

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        disabled={disabled}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium outline-none transition-colors focus-visible:border-fg disabled:opacity-50",
          value.length ? "border-fg/60 text-fg" : "border-border text-muted hover:border-fg/50 hover:text-fg",
          className,
        )}
        aria-label="Choose skills"
      >
        <Sparkles className="size-3.5" />
        Skills{value.length > 0 && <span className="tabular-nums">· {value.length}</span>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" side="top" sideOffset={8} className="panel z-50 w-72 rounded-md p-1.5 text-fg">
          <div className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">Skills for Claude</div>
          {SKILLS.map((s) => {
            const on = value.includes(s.id);
            return (
              <DropdownMenu.CheckboxItem
                key={s.id}
                checked={on}
                onCheckedChange={() => toggle(s.id)}
                onSelect={(e) => e.preventDefault()}
                className="flex cursor-pointer items-start gap-2.5 rounded-[4px] px-3 py-2 outline-none data-[highlighted]:bg-elevated"
              >
                <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] border", on ? "border-fg bg-fg text-bg" : "border-border-strong")}>
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span>
                  <span className="block text-[13px] font-semibold">{s.name}</span>
                  <span className="block text-[12px] leading-snug text-subtle">{s.description}</span>
                </span>
              </DropdownMenu.CheckboxItem>
            );
          })}
          <div className="px-3 pb-1.5 pt-2 text-[11px] leading-snug text-subtle">Checked skills apply to every request in this project until you uncheck them.</div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
