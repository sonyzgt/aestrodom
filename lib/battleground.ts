import "server-only";
import { formatEther } from "viem";
import { prisma } from "@/lib/db";
import { log, errorMessage } from "@/lib/logger";
import { getProjectDomain, getProjectUrl } from "@/lib/deployment/domain";
import { tokenState } from "@/lib/pons/server";
import type { Address } from "@/lib/pons/types";

/**
 * Public Battleground: every listed project that is live right now, with its token (if any)
 * ranked by ETH raised on the bonding curve. Token numbers come from the chain, not the database.
 * Only public facts are exposed: project name, description, domain, vote counts, token address and
 * on-chain state. `voted` / `mine` are relative to the viewer and never reveal who owns a project.
 */
export interface BattleRow {
  id: string;
  name: string;
  description: string;
  domain: string;
  url: string;
  liveSince: Date | null;
  votes: number;
  /** Votes cast in the last 24 hours (drives "Trending"). */
  votes24h: number;
  /** The viewer has upvoted this project. */
  voted: boolean;
  /** The viewer owns this project (owners can't vote for their own app). */
  mine: boolean;
  token: null | {
    symbol: string;
    name: string;
    address: string;
    curve: string;
    logoUrl: string | null;
    phaseLabel: string;
    graduated: boolean;
    raisedEth: number | null;
    thresholdEth: number | null;
    progressPct: number | null;
    creatorTaxPct: number;
    /** The launch's creator fee recipient (public on-chain); where vote rewards are sent. */
    rewardWallet: string;
  };
}

function ipfsToHttp(logo: string | null): string | null {
  if (!logo) return null;
  if (logo.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${logo.slice(7).replace(/^ipfs\//, "")}`;
  return /^https:\/\//.test(logo) ? logo : null;
}

const MAX_ROWS = 200;
const MAX_ONCHAIN_READS = 60;

export const SORTS = ["trending", "top", "tokens", "new"] as const;
export type BattleSort = (typeof SORTS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getBattleground(viewerId?: string | null): Promise<BattleRow[]> {
  const since = new Date(Date.now() - DAY_MS);
  const projects = await prisma.project.findMany({
    where: { listed: true, deployments: { some: { kind: "PRODUCTION", status: "RUNNING" } } },
    orderBy: { updatedAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      userId: true,
      _count: { select: { votes: true } },
      deployments: { where: { kind: "PRODUCTION", status: "RUNNING" }, orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true } },
      ponsLaunches: {
        where: { status: "LAUNCHED" },
        take: 1,
        select: { symbol: true, name: true, tokenAddress: true, curveAddress: true, logo: true, creatorTaxBps: true, creatorFeeRecipient: true },
      },
    },
  });

  const ids = projects.map((p) => p.id);
  const [recent, mineVoted] = await Promise.all([
    prisma.projectVote.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
    viewerId ? prisma.projectVote.findMany({ where: { userId: viewerId, projectId: { in: ids } }, select: { projectId: true } }) : [],
  ]);
  const recentBy = new Map(recent.map((r) => [r.projectId, r._count._all]));
  const votedBy = new Set(mineVoted.map((v) => v.projectId));

  let reads = 0;
  const rows = await Promise.all(
    projects.map(async (p): Promise<BattleRow> => {
      const l = p.ponsLaunches[0];
      let token: BattleRow["token"] = null;
      if (l?.tokenAddress && l.curveAddress) {
        let state: Awaited<ReturnType<typeof tokenState>> | null = null;
        if (reads++ < MAX_ONCHAIN_READS) {
          state = await tokenState(l.tokenAddress as Address, l.curveAddress as Address).catch((err) => {
            log.warn("battleground.state.error", { projectId: p.id, error: errorMessage(err) });
            return null;
          });
        }
        const raised = state?.raised ? Number(formatEther(BigInt(state.raised))) : null;
        const threshold = state?.threshold ? Number(formatEther(BigInt(state.threshold))) : null;
        token = {
          symbol: l.symbol,
          name: l.name,
          address: l.tokenAddress,
          curve: l.curveAddress,
          logoUrl: ipfsToHttp(l.logo),
          phaseLabel: state?.phaseLabel ?? "—",
          graduated: state?.graduated ?? false,
          raisedEth: raised,
          thresholdEth: threshold,
          progressPct: state?.graduated ? 100 : raised !== null && threshold ? Math.min(100, (raised / threshold) * 100) : null,
          creatorTaxPct: l.creatorTaxBps / 100,
          rewardWallet: l.creatorFeeRecipient,
        };
      }
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        domain: getProjectDomain(p.slug),
        url: getProjectUrl(p.slug),
        liveSince: p.deployments[0]?.startedAt ?? null,
        votes: p._count.votes,
        votes24h: recentBy.get(p.id) ?? 0,
        voted: votedBy.has(p.id),
        mine: !!viewerId && p.userId === viewerId,
        token,
      };
    }),
  );
  return rows;
}

const newest = (a: BattleRow, b: BattleRow) => (b.liveSince?.getTime() ?? 0) - (a.liveSince?.getTime() ?? 0);

/**
 * Orders rows for a tab. Only apps with a token compete for votes, so every tab except "new"
 * (all live apps) keeps token apps only.
 */
export function sortBattle(rows: BattleRow[], sort: BattleSort): BattleRow[] {
  const list = sort === "new" ? [...rows] : rows.filter((r) => r.token);
  if (sort === "trending") return list.sort((a, b) => b.votes24h - a.votes24h || b.votes - a.votes || newest(a, b));
  if (sort === "top") return list.sort((a, b) => b.votes - a.votes || b.votes24h - a.votes24h || newest(a, b));
  if (sort === "new") return list.sort(newest);

  // Ranked by progress toward graduation (graduated at the top).
  return list.sort((a, b) => (b.token!.progressPct ?? -1) - (a.token!.progressPct ?? -1) || newest(a, b));
}

/** Platform-wide numbers for the header strip. */
export async function battleStats() {
  const since = new Date(Date.now() - DAY_MS);
  const [builtToday, votesToday] = await Promise.all([
    prisma.project.count({ where: { createdAt: { gte: since } } }),
    prisma.projectVote.count({ where: { createdAt: { gte: since } } }),
  ]);
  return { builtToday, votesToday };
}
