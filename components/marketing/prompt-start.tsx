"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline "describe your app" field: carries the prompt into the new-project page (via login if needed). */
export function PromptStart({
  signedIn,
  className,
  placeholder = "Describe the app you want…",
  suggestions = [],
  typewriter = false,
}: {
  signedIn: boolean;
  className?: string;
  placeholder?: string;
  suggestions?: string[];
  /** Types the suggestions into the placeholder, one after another, while the field is empty. */
  typewriter?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const typed = useTypewriter(typewriter ? suggestions : []);
  function go() {
    const target = value.trim() ? `/dashboard/new?prompt=${encodeURIComponent(value.trim().slice(0, 2000))}` : "/dashboard/new";
    router.push(signedIn ? target : `/login?callbackUrl=${encodeURIComponent(target)}`);
  }
  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="panel flex w-full items-center gap-2 rounded-lg p-1.5 focus-within:border-border-strong"
      >
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-md bg-inset px-4">
          <span aria-hidden className="font-mono text-[15px] font-bold text-red">&gt;</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={typed ?? placeholder}
            maxLength={2000}
            className="h-12 min-w-0 flex-1 bg-transparent font-mono text-[14px] text-fg outline-none placeholder:text-subtle"
            aria-label="Describe the app you want to build"
          />
        </label>
        <button type="submit" className="btn-primary flex h-12 shrink-0 items-center gap-2 rounded-md px-5 text-sm">
          <span className="max-sm:hidden">Generate</span> <ArrowRight className="size-4" />
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue(s)}
              className="rounded-sm border border-border px-2.5 py-1 font-mono text-[12px] text-muted transition-colors hover:border-red hover:text-red"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cycles through phrases in a typing/erasing loop. Returns null when there is nothing to type or motion is reduced. */
function useTypewriter(phrases: string[]): string | null {
  const [text, setText] = useState<string | null>(null);
  const key = phrases.join("\n");

  useEffect(() => {
    const list = key ? key.split("\n") : [];
    if (!list.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let phrase = 0;
    let length = 0;
    let erasing = false;
    let timer = 0;
    const tick = () => {
      const current = list[phrase]!;
      if (!erasing && length === current.length) {
        erasing = true;
        timer = window.setTimeout(tick, 1600);
        return;
      }
      if (erasing && length === 0) {
        erasing = false;
        phrase = (phrase + 1) % list.length;
      }
      length += erasing ? -1 : 1;
      setText(`${list[phrase]!.slice(0, length)}▍`);
      timer = window.setTimeout(tick, erasing ? 28 : 55 + Math.random() * 50);
    };
    timer = window.setTimeout(tick, 900);
    return () => window.clearTimeout(timer);
  }, [key]);

  return text;
}
