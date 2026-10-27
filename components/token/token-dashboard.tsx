"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { formatEther } from "viem";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/misc";
import { explorerAddress, explorerToken, explorerTx } from "@/lib/chains/robinhood";
import { shortAddress } from "@/lib/utils";

export interface TokenLaunchJson {
  status: "PENDING" | "LAUNCHED" | "FAILED";
  name: string;
  symbol: string;
  tokenAddress: string | null;
  curveAddress: string | null;
  transactionHash: string;
  creatorTaxBps: number;
  buybackEnabled: boolean;
  domain: string;
  error: string | null;
}

export interface TokenStateJson {
  phase: number;
  phaseLabel: string;
  creatorTaxBps: number;
  buybackEnabled: boolean;
  raised: string | null;
  threshold: string | null;
  graduated: boolean;
  checkedAt: string;
}

const REFRESH_MS = 20_000;

/** Polls token state every 20s while visible; phase comes from the factory's on-chain record. */
export function useTokenData(projectId: string, enabled: boolean, version = 0) {
  const [data, setData] = useState<{ launch: TokenLaunchJson | null; state: TokenStateJson | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/projects/${projectId}/token`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !stop && d && setData(d))
        .catch(() => undefined);
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [projectId, enabled, version]);
  return data;
}

export function TokenDashboard({ launch, state }: { launch: TokenLaunchJson; state: TokenStateJson | null }) {
  if (launch.status === "PENDING") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted">
        <Loader2 className="size-4 animate-spin text-fg" /> ${launch.symbol} launch is confirming on Robinhood Chain…
      </div>
    );
  }
  if (launch.status === "FAILED") {
    return <div className="rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger">Launch failed: {launch.error ?? "unknown error"}</div>;
  }
  const copy = (v: string) => {
    navigator.clipboard.writeText(v).then(() => toast.success("Copied"));
  };
  const progress = state?.raised && state.threshold && BigInt(state.threshold) > 0n ? Number((BigInt(state.raised) * 10000n) / BigInt(state.threshold)) / 100 : null;

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="text-xl font-semibold tracking-tight">${launch.symbol}</div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-success"><StatusDot tone="success" /> LIVE</span>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-5 text-sm sm:grid-cols-2">
        <Item k="Token Address" v={shortAddress(launch.tokenAddress, 6)} mono onCopy={() => launch.tokenAddress && copy(launch.tokenAddress)} />
        <Item k="Curve Address" v={shortAddress(launch.curveAddress, 6)} mono onCopy={() => launch.curveAddress && copy(launch.curveAddress)} />
        <Item k="Website" v={launch.domain} />
        <Item k="Launch Transaction" v={shortAddress(launch.transactionHash, 6)} mono />
        <Item k="Creator Tax" v={`${(state?.creatorTaxBps ?? launch.creatorTaxBps) / 100}%`} />
        <Item k="Buyback" v={(state?.buybackEnabled ?? launch.buybackEnabled) ? "Enabled" : "Disabled"} />
        <Item k="Phase" v={state?.phaseLabel ?? "—"} />
        {progress !== null && state?.raised && state.threshold && (
          <div className="sm:col-span-2">
            <dt className="mb-2 flex justify-between text-xs text-muted">
              <span>Graduation progress</span>
              <span>
                {Number(formatEther(BigInt(state.raised))).toFixed(4)} / {Number(formatEther(BigInt(state.threshold))).toFixed(2)} ETH
              </span>
            </dt>
            <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
              <div className="h-full rounded-full bg-[image:var(--primary)]" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
        {launch.tokenAddress && (
          <Button asChild size="sm" variant="secondary">
            <a href={explorerToken(launch.tokenAddress)} target="_blank" rel="noopener noreferrer">View Token <ExternalLink /></a>
          </Button>
        )}
        <Button asChild size="sm" variant="secondary">
          <a href={`https://${launch.domain}`} target="_blank" rel="noopener noreferrer">Open Website <ExternalLink /></a>
        </Button>
        {launch.tokenAddress && (
          <Button size="sm" variant="secondary" onClick={() => copy(launch.tokenAddress!)}>Copy Address <Copy /></Button>
        )}
        <Button asChild size="sm" variant="secondary">
          <a href={explorerTx(launch.transactionHash)} target="_blank" rel="noopener noreferrer">View Transaction <ExternalLink /></a>
        </Button>
        {launch.curveAddress && (
          <Button asChild size="sm" variant="ghost">
            <a href={explorerAddress(launch.curveAddress)} target="_blank" rel="noopener noreferrer">Curve <ExternalLink /></a>
          </Button>
        )}
      </div>
      {state?.checkedAt && <div className="px-5 pb-3 text-[11px] text-subtle">On-chain state · updated {new Date(state.checkedAt).toLocaleTimeString()}</div>}
    </div>
  );
}

function Item({ k, v, mono, onCopy }: { k: string; v: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div>
      <dt className="text-xs text-muted">{k}</dt>
      <dd className={`mt-1 flex items-center gap-2 ${mono ? "font-mono text-[13px]" : ""}`}>
        {v || "—"}
        {onCopy && (
          <button onClick={onCopy} className="text-subtle hover:text-fg" aria-label={`Copy ${k}`}>
            <Copy className="size-3.5" />
          </button>
        )}
      </dd>
    </div>
  );
}
