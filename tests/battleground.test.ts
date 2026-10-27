import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/pons/server", () => ({ tokenState: vi.fn() }));

import { sortBattle, type BattleRow } from "@/lib/battleground";

const hour = 3_600_000;
function row(id: string, votes: number, votes24h: number, hoursAgo: number, progressPct?: number): BattleRow {
  return {
    id,
    name: id,
    description: "",
    domain: `${id}.aestrodom.org`,
    url: `https://${id}.aestrodom.org`,
    liveSince: new Date(Date.now() - hoursAgo * hour),
    votes,
    votes24h,
    voted: false,
    mine: false,
    token:
      progressPct === undefined
        ? null
        : { symbol: id.toUpperCase(), name: id, address: "0x0", curve: "0x0", logoUrl: null, phaseLabel: "Curve", graduated: progressPct >= 100, raisedEth: null, thresholdEth: null, progressPct, creatorTaxPct: 0, rewardWallet: "0x1" },
  };
}

const rows = [row("a", 10, 0, 50), row("b", 3, 3, 5, 40), row("c", 3, 3, 1), row("d", 0, 0, 0.5, 90)];
const ids = (r: BattleRow[]) => r.map((x) => x.id);

describe("battleground sorting", () => {
  it("trending: token apps only, by votes in 24h, then all-time votes, then newest", () => {
    const more = [...rows, row("e", 1, 0, 2, 10), row("f", 0, 0, 0.1, 5)];
    expect(ids(sortBattle(more, "trending"))).toEqual(["b", "e", "f", "d"]);
  });

  it("top: token apps only, by all-time votes", () => {
    expect(ids(sortBattle(rows, "top"))).toEqual(["b", "d"]);
  });

  it("new: every live app, newest deployment first", () => {
    expect(ids(sortBattle(rows, "new"))).toEqual(["d", "c", "b", "a"]);
  });

  it("tokens: only apps with a token, by curve progress", () => {
    expect(ids(sortBattle(rows, "tokens"))).toEqual(["d", "b"]);
  });

  it("does not reorder the input", () => {
    const copy = [...rows];
    sortBattle(rows, "top");
    expect(rows).toEqual(copy);
  });
});
