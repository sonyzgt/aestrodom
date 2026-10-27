"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Upvote toggle. Signed-out visitors are sent to sign in; owners see the count but can't vote. */
export function VoteButton({ projectId, votes: initialVotes, voted: initialVoted, mine, signedIn, size = "md" }: { projectId: string; votes: number; voted: boolean; mine: boolean; signedIn: boolean; size?: "md" | "lg" }) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(initialVoted);
  const [busy, setBusy] = useState(false);

  const cls = cn(
    "inline-flex shrink-0 items-center gap-1.5 border font-medium tabular-nums transition-colors",
    size === "lg" ? "h-11 px-4 text-[15px]" : "h-9 px-3 text-[13px]",
    voted ? "border-fg bg-fg text-bg" : "border-border text-fg hover:border-fg",
  );
  const label = (
    <>
      <ChevronUp className={size === "lg" ? "size-5" : "size-4"} strokeWidth={2.5} />
      {votes.toLocaleString("en-US")}
    </>
  );

  if (!signedIn) {
    return (
      <Link href="/login?callbackUrl=%2Fbattleground" className={cls} title="Sign in to vote" aria-label={`Sign in to vote, ${votes} votes`}>
        {label}
      </Link>
    );
  }
  if (mine) {
    return (
      <span className={cn(cls, "cursor-default opacity-60 hover:border-border")} title="Your app" aria-label={`${votes} votes on your app`}>
        {label}
      </span>
    );
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !voted;
    setVoted(next);
    setVotes((v) => v + (next ? 1 : -1));
    try {
      const res = await fetch(`/api/battleground/${projectId}/vote`, { method: next ? "POST" : "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Could not save your vote.");
      setVotes(d.votes);
      setVoted(d.voted);
    } catch (err) {
      setVoted(!next);
      setVotes((v) => v + (next ? -1 : 1));
      toast.error(err instanceof Error ? err.message : "Could not save your vote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={voted} aria-label={voted ? `Remove your vote, ${votes} votes` : `Upvote, ${votes} votes`} className={cls}>
      {label}
    </button>
  );
}
