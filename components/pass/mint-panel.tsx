"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicClient } from "viem";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { Check, ExternalLink, Gift, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { WalletProviders } from "@/components/wallet/providers";
import { Button } from "@/components/ui/button";
import { ROBINHOOD_CHAIN_ID, explorerAddress, explorerTx } from "@/lib/chains/robinhood";
import { PASS_ABI, PASS_METADATA_URI } from "@/lib/nft/abi";
import { describeLaunchError } from "@/lib/pons/launch";
import { shortAddress } from "@/lib/utils";

interface Status {
  configured: boolean;
  sponsorReady: boolean;
  max: number;
  contract?: `0x${string}`;
  minted?: number;
  mintOpen?: boolean;
  hasMinted?: boolean;
  passes?: number[];
  freeLaunchesLeft?: number;
  dailyCapLeft?: number;
  resetsAt?: string;
  owner?: string;
  metadataURI?: string;
  mintStart?: string;
}

/** Ticks every second until `iso`, then reports 0. */
function useCountdown(iso?: string) {
  const [now, setNow] = useState(() => Date.now());
  const target = iso ? Date.parse(iso) : 0;
  useEffect(() => {
    if (!target || target <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  return Math.max(0, target - now);
}

function fmtLeft(ms: number) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export function MintPanel(props: { signedIn: boolean }) {
  return (
    <WalletProviders>
      <Inner {...props} />
    </WalletProviders>
  );
}

function Inner({ signedIn }: { signedIn: boolean }) {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID }) as PublicClient | undefined;
  const { data: walletClient } = useWalletClient({ chainId: ROBINHOOD_CHAIN_ID });
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [tx, setTx] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/pass${address ? `?wallet=${address}` : ""}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load the pass.");
        setStatus(d);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [address]);
  useEffect(load, [load]);

  const wrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;
  const minted = status?.minted ?? 0;
  const max = status?.max ?? 500;
  const soldOut = minted >= max;
  const opensIn = useCountdown(status?.mintStart);
  // Re-read the chain once the countdown reaches zero.
  useEffect(() => {
    if (status?.mintStart && opensIn === 0 && Date.parse(status.mintStart) > Date.now() - 5000) load();
  }, [opensIn, status?.mintStart, load]);
  const pct = Math.min(100, (minted / max) * 100);

  async function mint() {
    if (!walletClient || !publicClient || !address || !status?.contract) return;
    setMinting(true);
    try {
      const { request } = await publicClient.simulateContract({ account: address, address: status.contract, abi: PASS_ABI, functionName: "mint" });
      const hash = await walletClient.writeContract(request);
      setTx(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("The mint transaction reverted.");
      toast.success("Your Aestrodom Pass is minted");
      load();
    } catch (err) {
      const d = describeLaunchError(err);
      const name = (d.message.match(/\((\w+)\)/) ?? [])[1];
      toast.error(
        name === "AlreadyMinted" ? "This wallet already minted a pass." : name === "SoldOut" ? "All 500 passes are minted." : name === "MintClosed" || name === "MintNotStarted" ? "Minting is not open yet." : d.message,
      );
    } finally {
      setMinting(false);
    }
  }

  if (loadError) return <p className="text-sm text-danger">{loadError}</p>;
  if (!status) return <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Reading the pass from Robinhood Chain…</div>;
  if (!status.configured) {
    return (
      <div className="border border-border p-6">
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-subtle">Status</div>
        <p className="mt-2 text-lg font-medium">Minting opens soon.</p>
        <p className="mt-1 text-sm text-muted">Follow @aestrodom_ai on X for the mint announcement.</p>
      </div>
    );
  }

  const held = status.passes ?? [];
  const notStarted = opensIn > 0;
  const isOwner = !!address && !!status.owner && address.toLowerCase() === status.owner.toLowerCase();
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between font-mono text-[13px] uppercase tracking-[0.12em] text-muted">
          <span>Minted</span>
          <span className="text-fg">{minted} / {max}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-elevated">
          <div className="h-full rounded-full bg-fg transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {notStarted && status.mintOpen && (
        <div className="border border-border p-4">
          <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-subtle">Mint opens in</div>
          <div className="mt-1 font-mono text-[28px] font-medium tabular-nums tracking-tight">{fmtLeft(opensIn)}</div>
          <div className="mt-1 text-xs text-muted">{new Date(status.mintStart!).toLocaleString()} · opens automatically</div>
        </div>
      )}

      {!isConnected ? (
        <div className="space-y-3 border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted"><Wallet className="size-4" /> Connect a wallet to mint</div>
          <div className="flex flex-wrap gap-2">
            {connectors.map((c) => (
              <Button key={c.id} size="sm" variant="secondary" onClick={() => connect({ connector: c, chainId: ROBINHOOD_CHAIN_ID })} disabled={connecting}>
                {c.name}
              </Button>
            ))}
          </div>
          {connectError && <p className="text-xs text-danger">{connectError.message.split("\n")[0]}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-border px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-success" /><span className="font-mono text-[13px]">{shortAddress(address)}</span></span>
          <span className="flex items-center gap-3">
            {wrongChain && <Button size="sm" variant="accent" onClick={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })} loading={switching}>Switch to Robinhood Chain</Button>}
            <button onClick={() => disconnect()} className="text-xs text-subtle hover:text-fg">Disconnect</button>
          </span>
        </div>
      )}

      {isConnected && (
        status.hasMinted ? (
          <div className="flex items-center gap-2 text-sm text-success"><Check className="size-4" /> This wallet has minted its pass.</div>
        ) : (
          <Button size="lg" variant="accent" className="w-full" onClick={mint} loading={minting} disabled={!status.mintOpen || notStarted || soldOut || wrongChain || !walletClient}>
            {soldOut ? "Sold out" : !status.mintOpen ? "Minting is closed" : notStarted ? "Not open yet" : "Mint for free"}
          </Button>
        )
      )}
      {tx && (
        <a href={explorerTx(tx)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-fg">
          {shortAddress(tx, 8)} <ExternalLink className="size-3" />
        </a>
      )}

      {held.length > 0 && (
        <div className="border border-border p-4 text-sm">
          <div className="flex items-center gap-2 font-medium"><Gift className="size-4" /> You hold pass {held.map((id) => `#${id}`).join(", ")}</div>
          <p className="mt-1 text-muted">
            {(status.freeLaunchesLeft ?? 0) > 0
              ? `${status.freeLaunchesLeft} free launch${status.freeLaunchesLeft === 1 ? "" : "es"} available today. Open a deployed project and press Launch Token.`
              : "Today's free launch is used. It resets at 00:00 UTC."}
          </p>
          {!signedIn && <p className="mt-1 text-muted">Sign in to Aestrodom to build an app and launch its token.</p>}
        </div>
      )}

      {isOwner && status.contract && (
        <OwnerTools contract={status.contract} metadataURI={status.metadataURI ?? ""} mintOpen={!!status.mintOpen} disabled={wrongChain} onDone={load} />
      )}

      <p className="text-xs text-subtle">
        Free mint, one per wallet. You only pay the network fee (a fraction of a cent).{" "}
        {status.contract && (
          <a href={explorerAddress(status.contract)} target="_blank" rel="noopener noreferrer" className="underline hover:text-fg">
            Contract {shortAddress(status.contract)}
          </a>
        )}
      </p>
    </div>
  );
}

/** Shown only to the contract owner: point the metadata at IPFS and open or close minting. */
function OwnerTools({ contract, metadataURI, mintOpen, disabled, onDone }: { contract: `0x${string}`; metadataURI: string; mintOpen: boolean; disabled: boolean; onDone: () => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID }) as PublicClient | undefined;
  const { data: walletClient } = useWalletClient({ chainId: ROBINHOOD_CHAIN_ID });
  const [busy, setBusy] = useState<"uri" | "mint" | null>(null);
  const upToDate = metadataURI === PASS_METADATA_URI;

  async function send(kind: "uri" | "mint") {
    if (!walletClient || !publicClient || !address) return;
    setBusy(kind);
    try {
      let hash: `0x${string}`;
      if (kind === "uri") {
        const { request } = await publicClient.simulateContract({ account: address, address: contract, abi: PASS_ABI, functionName: "setMetadataURI", args: [PASS_METADATA_URI] });
        hash = await walletClient.writeContract(request);
      } else {
        const { request } = await publicClient.simulateContract({ account: address, address: contract, abi: PASS_ABI, functionName: "setMintOpen", args: [!mintOpen] });
        hash = await walletClient.writeContract(request);
      }
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
      toast.success(kind === "uri" ? "Metadata updated. Marketplaces may take a few minutes to refresh." : mintOpen ? "Minting closed" : "Minting opened");
      onDone();
    } catch (err) {
      toast.error(describeLaunchError(err).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 border border-border p-4 text-sm">
      <div className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" /> Owner tools</div>
      <div className="space-y-1">
        <div className="text-muted">Metadata</div>
        <div className="break-all font-mono text-[12px]">{metadataURI || "—"}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={upToDate ? "secondary" : "accent"} onClick={() => send("uri")} loading={busy === "uri"} disabled={disabled || upToDate || !!busy}>
          {upToDate ? "Metadata is on IPFS" : "Use IPFS metadata"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => send("mint")} loading={busy === "mint"} disabled={disabled || !!busy}>
          {mintOpen ? "Close minting" : "Open minting"}
        </Button>
      </div>
    </div>
  );
}
