import Link from "next/link";
import { ArrowUpRight, Coins, Flame } from "lucide-react";
import { currentUser } from "@/lib/session";
import { SORTS, battleStats, getBattleground, sortBattle, type BattleRow, type BattleSort } from "@/lib/battleground";
import { explorerAddress, explorerToken } from "@/lib/chains/robinhood";
import { shortAddress, timeAgo, cn } from "@/lib/utils";
import { SiteHeader } from "@/components/marketing/site-header";
import { env } from "@/lib/env";
import { StatusDot } from "@/components/ui/misc";
import { LandingMotion } from "@/components/marketing/landing-motion";
import { LivePreview } from "@/components/battleground/live-preview";
import { VoteButton } from "@/components/battleground/vote-button";

export const metadata = {
  title: "Battleground",
  description: "Apps with a token battle for votes on Aestrodom. Top-voted apps win rewards.",
};
export const dynamic = "force-dynamic";

const TABS: Record<BattleSort, { label: string; hint: string }> = {
  trending: { label: "Trending", hint: "Apps with a token, by votes in the last 24 hours." },
  top: { label: "Top voted", hint: "Apps with a token, by votes of all time." },
  tokens: { label: "Curve progress", hint: "Apps with a token, by Pons V2 bonding curve progress read from Robinhood Chain." },
  new: { label: "All apps", hint: "Every live app, newest first. Only apps with a token can be voted on." },
};

function fmtEth(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 4 : 2 });
}

export default async function BattlegroundPage({ searchParams }: { searchParams: Promise<{ sort?: string; filter?: string }> }) {
  const { sort: raw, filter } = await searchParams;
  // `?filter=tokens` is the old link format.
  const sort: BattleSort = (SORTS as readonly string[]).includes(raw ?? "") ? (raw as BattleSort) : filter === "tokens" ? "tokens" : "trending";
  const user = await currentUser();
  const [all, stats] = await Promise.all([getBattleground(user?.id), battleStats()]);
  const rows = sortBattle(all, sort);
  const signedIn = !!user;

  // App of the day: the token app with the most votes in 24h.
  const spotlight = sortBattle(all, "trending")[0] ?? null;
  const tokens = all.filter((r) => r.token).length;

  return (
    <div className="min-h-dvh">
      <SiteHeader signedIn={signedIn} />
      <LandingMotion>
        <main className="mx-auto w-full max-w-[1680px] px-5 pb-24 sm:px-8 lg:px-12 xl:px-16">
          <section className="pb-10 pt-14 sm:pt-20">
            <h1 className="text-balance text-[clamp(1.6rem,7vw,4rem)] font-medium leading-[1.04] tracking-[-0.035em]">
              <span data-hero-line className="block">
                <span data-parallax className="block">Battleground.</span>
              </span>
              <span data-hero-line className="block text-muted">
                <span data-parallax className="block">Apps with a token battle for votes. You pick the winners.</span>
              </span>
            </h1>
            <p data-hero-cta className="prose-serif mt-6 max-w-2xl">
              Each card is the real app, running live. Every app that has launched its token on Pons V2 can be voted on, and the
              top-voted apps win rewards sent to their token creator wallet. Want in? Build an app, deploy it and launch its token.
            </p>
          </section>

          <section data-reveal className="grid grid-cols-2 border border-border lg:grid-cols-4">
            {[
              [all.length.toLocaleString(), "apps live now"],
              [stats.builtToday.toLocaleString(), "apps built in the last 24h"],
              [stats.votesToday.toLocaleString(), "votes in the last 24h"],
              [tokens.toLocaleString(), "apps with a token"],
            ].map(([v, label], i) => (
              <div
                key={label}
                className={cn("px-4 py-4 sm:px-5", i % 2 === 1 && "border-l border-border", i >= 2 && "border-t border-border lg:border-t-0", i === 2 && "lg:border-l")}
              >
                <div className="text-[28px] font-medium tabular-nums tracking-tight">{v}</div>
                <div className="text-[13px] text-muted">{label}</div>
              </div>
            ))}
          </section>

          {spotlight ? (
            <Spotlight r={spotlight} signedIn={signedIn} />
          ) : (
            <section data-reveal className="mt-10 border border-border px-6 py-12 text-center">
              <Coins className="mx-auto size-6" />
              <p className="mt-4 text-[18px] font-medium">No app has launched a token yet.</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">Be the first: deploy your app, launch its token from the builder, and it enters the vote.</p>
            </section>
          )}

          <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex gap-1" role="tablist" aria-label="Sort apps">
                {SORTS.map((s) => (
                  <Link
                    key={s}
                    href={s === "trending" ? "/battleground" : `/battleground?sort=${s}`}
                    role="tab"
                    aria-selected={sort === s}
                    scroll={false}
                    className={cn(
                      "border px-3 py-1.5 text-[13px] transition-colors",
                      sort === s ? "border-fg text-fg" : "border-border text-muted hover:border-border-strong hover:text-fg",
                    )}
                  >
                    {TABS[s].label}
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-subtle">{TABS[sort].hint}</p>
            </div>
            <Link href={signedIn ? "/dashboard/new" : "/login?callbackUrl=%2Fdashboard%2Fnew"} className="link text-[14px]">
              Build your own and enter →
            </Link>
          </div>

          {rows.length === 0 ? (
            <div className="mt-5 border border-border py-16 text-center">
              <p className="text-[17px] font-medium">{sort === "new" ? "No apps here yet." : "No app has launched a token yet."}</p>
              <p className="mt-2 text-sm text-muted">
                {sort === "new" ? "Deploy a project and it appears on the Battleground automatically." : "Launch a token for your deployed app to enter the vote."}
              </p>
            </div>
          ) : (
            <section data-stagger className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {rows.map((r, i) => (
                <Card key={r.id} r={r} rank={i + 1} signedIn={signedIn} showRank={sort !== "new"} />
              ))}
            </section>
          )}

          <p className="prose-serif mt-6 max-w-2xl !text-[14px]">
            Only apps with a launched token can be voted on.
            {env.voteMinHoldUsd > 0 && ` To vote, hold at least $${env.voteMinHoldUsd} of $AESTRODOM in the wallet you sign in with.`} One vote
            per account per app, and you can&apos;t vote for your own.
            Rewards go to the creator wallet of the app&apos;s token. Listing is on by default for deployed projects; owners can hide
            a project in its settings. Token figures come from the chain.
          </p>
        </main>
      </LandingMotion>
    </div>
  );
}

function Spotlight({ r, signedIn }: { r: BattleRow; signedIn: boolean }) {
  return (
    <section data-reveal className="mt-10 grid border border-border lg:grid-cols-[1.5fr_1fr]">
      <div className="relative border-b border-border lg:border-b-0 lg:border-r">
        <LivePreview url={r.url} name={r.name} eager />
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0" aria-label={`Open ${r.name}`} />
      </div>
      <div className="flex flex-col p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-subtle">
          <Flame className="size-4 text-fg" /> {r.votes24h > 0 ? "App of the day" : "In the vote"}
        </div>
        <h2 className="mt-4 text-balance text-[clamp(1.6rem,3vw,2.6rem)] font-medium leading-tight tracking-[-0.03em]">{r.name}</h2>
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 truncate font-mono text-[13px] text-muted hover:text-fg">
          {r.domain}
        </a>
        {r.description && <p className="mt-4 line-clamp-4 text-[15px] leading-relaxed text-muted">{r.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
          <VoteButton projectId={r.id} votes={r.votes} voted={r.voted} mine={r.mine} signedIn={signedIn} size="lg" />
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 bg-fg px-5 text-[15px] font-medium text-bg">
            Open app <ArrowUpRight className="size-4" />
          </a>
          <span className="text-[13px] text-subtle">{r.votes24h.toLocaleString("en-US")} votes today</span>
        </div>
        {r.token && <RewardLine wallet={r.token.rewardWallet} symbol={r.token.symbol} className="mt-4" />}
      </div>
    </section>
  );
}

function Card({ r, rank, signedIn, showRank }: { r: BattleRow; rank: number; signedIn: boolean; showRank: boolean }) {
  const t = r.token;
  return (
    <article className="group flex flex-col border border-border bg-bg transition-colors hover:border-border-strong">
      <div className="relative border-b border-border">
        <LivePreview url={r.url} name={r.name} />
        {showRank && <span className="absolute left-3 top-3 bg-fg px-2 py-0.5 font-mono text-[12px] text-bg">#{String(rank).padStart(2, "0")}</span>}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 bg-bg/90 px-2 py-0.5 text-[12px] opacity-0 transition-opacity group-hover:opacity-100">
          Open <ArrowUpRight className="size-3" />
        </span>
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0" aria-label={`Open ${r.name}`} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[16px] font-medium tracking-tight">{r.name}</h3>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="block truncate font-mono text-[12.5px] text-muted hover:text-fg">
              {r.domain}
            </a>
          </div>
          {t && <VoteButton projectId={r.id} votes={r.votes} voted={r.voted} mine={r.mine} signedIn={signedIn} />}
        </div>
        {r.description && <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{r.description}</p>}

        {t && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-1.5">
                {t.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logoUrl} alt="" className="size-4 object-cover" loading="lazy" />
                )}
                <span className="font-mono font-medium">${t.symbol}</span>
                <span className="flex items-center gap-1 text-muted">
                  <StatusDot tone={t.graduated ? "success" : "neutral"} /> {t.phaseLabel}
                </span>
              </span>
              <a href={explorerToken(t.address)} target="_blank" rel="noopener noreferrer" className="font-mono text-subtle hover:text-fg" title={t.address}>
                {shortAddress(t.address, 3)}
              </a>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden bg-elevated">
              <div className="h-full bg-[image:var(--primary)]" data-bar={t.progressPct ?? 0} style={{ width: `${t.progressPct ?? 0}%` }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[11.5px] text-muted">
              <span>
                {fmtEth(t.raisedEth)} / {fmtEth(t.thresholdEth)} ETH
              </span>
              <span className="text-fg">{t.progressPct === null ? "—" : `${t.progressPct.toFixed(1)}%`}</span>
            </div>
          </div>
        )}

        {t && <RewardLine wallet={t.rewardWallet} symbol={t.symbol} className="mt-3" />}

        <div className="mt-auto flex items-center justify-between pt-4 text-[12px] text-subtle">
          <span>{r.liveSince ? `live ${timeAgo(r.liveSince)}` : "live"}</span>
          {t ? r.votes24h > 0 && <span className="text-fg">+{r.votes24h} today</span> : <span>No token yet, not in the vote</span>}
        </div>
      </div>
    </article>
  );
}

/** Where rewards for this app go: its token's creator wallet (public on-chain). */
function RewardLine({ wallet, symbol, className }: { wallet: string; symbol: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-[12px] text-subtle", className)}>
      <span className="flex items-center gap-1.5">
        <Coins className="size-3.5" /> Rewards to ${symbol} creator
      </span>
      <a href={explorerAddress(wallet)} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-fg" title={wallet}>
        {shortAddress(wallet, 4)}
      </a>
    </div>
  );
}
