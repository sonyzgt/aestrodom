"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, formatUnits, parseEther, type PublicClient } from "viem";
import { useAccount, useBalance, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { AlertTriangle, Check, ExternalLink, Gift, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { RadioGroup, RadioItem } from "@/components/ui/misc";
import { LogoUpload } from "./logo-upload";
import { ROBINHOOD_CHAIN_ID, explorerTx } from "@/lib/chains/robinhood";
import { PONS_FACTORY_ABI, PONS_LAUNCH_AND_BUY_ABI } from "@/lib/pons/abi";
import { configFromJson, readCanLaunch, readLaunchConfigs, readLaunchEconomics, readLaunchFee, readMaxCreatorTaxBps } from "@/lib/pons/factory";
import { LaunchValidationError, buildTokenParams, describeLaunchError, parseTokenLaunched, quoteInitialBuy, randomSalt } from "@/lib/pons/launch";
import { BUYBACK_ENABLED, CREATOR_TAX_POLICY, NATIVE_PAIR_TOKEN, type Hex, type LaunchConfigJson, type PreparedLaunch, type TokenParams } from "@/lib/pons/types";
import { shortAddress } from "@/lib/utils";
import { freeLaunchMessage } from "@/lib/nft/abi";

type Step = "form" | "review" | "signing" | "confirming" | "success";

interface Review {
  params: TokenParams;
  launchConfigId: number;
  launchFee: bigint;
  economics: Hex;
  value: bigint;
  gasCost: bigint;
  mode: "launch" | "launch_buy";
  quoteIn: bigint;
  minTokensOut: bigint;
  expectedTokens: bigint;
  request: unknown;
}

/** Subset of GET /api/pass used here. */
interface PassInfo {
  configured: boolean;
  sponsorReady: boolean;
  passes?: number[];
  freeLaunchesLeft?: number;
  dailyCapLeft?: number;
  resetsAt?: string;
}

export interface LaunchedInfo {
  tokenAddress: string | null;
  curveAddress: string | null;
  transactionHash: string;
  symbol: string;
}

export function LaunchDialog({
  open,
  onOpenChange,
  projectId,
  onLaunched,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  onLaunched: (info: LaunchedInfo) => void;
}) {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID }) as PublicClient | undefined;
  const { data: walletClient } = useWalletClient({ chainId: ROBINHOOD_CHAIN_ID });
  const { data: balance } = useBalance({ address, chainId: ROBINHOOD_CHAIN_ID, query: { enabled: !!address } });

  const [prepared, setPrepared] = useState<PreparedLaunch | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [launched, setLaunched] = useState<{ token: string; curve: string } | null>(null);
  const [launchedSymbol, setLaunchedSymbol] = useState("");
  const [pass, setPass] = useState<PassInfo | null>(null);
  const [useFree, setUseFree] = useState(true);

  const [form, setForm] = useState({
    name: "",
    symbol: "",
    logo: "",
    description: "",
    website: "",
    twitter: "",
    telegram: "",
    discord: "",
    creatorFeeRecipient: "",
    creatorTaxBps: CREATOR_TAX_POLICY.minBps as number,
    configId: 0,
    mode: "launch" as "launch" | "launch_buy",
    buyAmount: "0.1",
    slippagePct: "5",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const wrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;

  // Load server-prepared configuration (on-chain values read by the server) when the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError(null);
    fetch(`/api/projects/${projectId}/token/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(address ? { wallet: address } : {}),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load launch configuration.");
        return d as PreparedLaunch;
      })
      .then((p) => {
        if (cancelled) return;
        setPrepared(p);
        setForm((f) => ({
          ...f,
          name: f.name || p.metadata.name,
          symbol: f.symbol || p.metadata.symbol,
          description: f.description || p.metadata.description,
          website: p.metadata.website,
          logo: f.logo || p.metadata.logo,
          configId: p.defaultConfigId ?? 0,
        }));
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [open, projectId, address]);

  // Aestrodom Pass holders get one sponsored launch per pass per day.
  useEffect(() => {
    if (!open || !address) {
      setPass(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/pass?wallet=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setPass(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, address]);
  const holdsPass = !!pass?.passes?.length;
  const freeAvailable = !!pass?.sponsorReady && (pass.freeLaunchesLeft ?? 0) > 0 && (pass.dailyCapLeft ?? 0) > 0;
  const free = freeAvailable && useFree;

  // Creator fee recipient defaults to the connected wallet (editable).
  useEffect(() => {
    if (address) setForm((f) => (f.creatorFeeRecipient ? f : { ...f, creatorFeeRecipient: address }));
  }, [address]);

  const selectedConfig: LaunchConfigJson | undefined = prepared?.configs.find((c) => c.id === form.configId);
  const canLaunchAndBuy = !!prepared?.deployment.launchAndBuy;

  const buyQuote = useMemo(() => {
    if (form.mode !== "launch_buy" || !selectedConfig) return null;
    try {
      const amount = parseEther(form.buyAmount || "0");
      return quoteInitialBuy(configFromJson(selectedConfig), amount, form.creatorTaxBps, Math.round(Number(form.slippagePct) * 100));
    } catch {
      return null;
    }
  }, [form.mode, form.buyAmount, form.creatorTaxBps, form.slippagePct, selectedConfig]);

  /** Re-reads everything from chain immediately before signing and simulates the exact transaction. */
  async function prepareReview() {
    if (!publicClient || !address || !prepared || !walletClient) return;
    setBusy(true);
    setError(null);
    try {
      const factory = prepared.deployment.factory;
      const [canLaunch, launchFee, maxTax, configs] = await Promise.all([
        readCanLaunch(publicClient, factory, address),
        readLaunchFee(publicClient, factory),
        readMaxCreatorTaxBps(publicClient, factory),
        readLaunchConfigs(publicClient, factory),
      ]);
      if (!canLaunch) throw new LaunchValidationError("Token launching is currently unavailable for this wallet.");
      const config = configs.find((c) => c.id === form.configId);
      if (!config || !config.enabled) throw new LaunchValidationError("This launch configuration is not available. Choose another one.");

      // Pin economics: the factory reverts with LaunchEconomicsMismatch if terms change before inclusion.
      const economics = await readLaunchEconomics(publicClient, factory, config.id, NATIVE_PAIR_TOKEN);
      const params = buildTokenParams(
        {
          name: form.name,
          symbol: form.symbol,
          logo: form.logo,
          description: form.description,
          website: form.website,
          twitter: form.twitter,
          telegram: form.telegram,
          discord: form.discord,
          creatorFeeRecipient: form.creatorFeeRecipient,
          creatorTaxBps: form.creatorTaxBps,
          buybackEnabled: BUYBACK_ENABLED,
        },
        { maxCreatorTaxBps: Math.min(maxTax, CREATOR_TAX_POLICY.maxBps), minCreatorTaxBps: CREATOR_TAX_POLICY.minBps, expectedEconomics: economics, salt: randomSalt() },
      );

      let request: unknown;
      let value = launchFee;
      let gas: bigint;
      let quoteIn = 0n;
      let expectedTokens = 0n;
      let minTokensOut = 0n;
      if (form.mode === "launch_buy") {
        const router = prepared.deployment.launchAndBuy;
        if (!router) throw new LaunchValidationError("Launch + Buy is not available.");
        quoteIn = parseEther(form.buyAmount || "0");
        const q = quoteInitialBuy(config, quoteIn, params.creatorTaxBps, Math.round(Number(form.slippagePct) * 100));
        expectedTokens = q.expectedTokens;
        minTokensOut = q.minTokensOut;
        value = launchFee + quoteIn;
        const sim = await publicClient.simulateContract({
          account: address,
          address: router,
          abi: PONS_LAUNCH_AND_BUY_ABI,
          functionName: "launchAndBuy",
          args: [params, BigInt(config.id), NATIVE_PAIR_TOKEN, quoteIn, minTokensOut, address, []],
          value,
        });
        request = sim.request;
        gas = await publicClient.estimateContractGas({ account: address, address: router, abi: PONS_LAUNCH_AND_BUY_ABI, functionName: "launchAndBuy", args: [params, BigInt(config.id), NATIVE_PAIR_TOKEN, quoteIn, minTokensOut, address, []], value });
      } else {
        const sim = await publicClient.simulateContract({
          account: address,
          address: factory,
          abi: PONS_FACTORY_ABI,
          functionName: "launchToken",
          args: [params, BigInt(config.id), NATIVE_PAIR_TOKEN],
          value,
        });
        request = sim.request;
        gas = await publicClient.estimateContractGas({ account: address, address: factory, abi: PONS_FACTORY_ABI, functionName: "launchToken", args: [params, BigInt(config.id), NATIVE_PAIR_TOKEN], value });
      }
      const fees = await publicClient.estimateFeesPerGas().catch(async () => ({ maxFeePerGas: await publicClient.getGasPrice() }));
      const gasCost = (gas * 12n) / 10n * (fees.maxFeePerGas ?? 0n);
      const bal = await publicClient.getBalance({ address });
      if (bal < value + gasCost) {
        throw new LaunchValidationError(`Insufficient balance. You need about ${formatEther(value + gasCost)} ETH (launch fee${quoteIn ? " + buy" : ""} + gas).`);
      }
      setReview({ params, launchConfigId: config.id, launchFee, economics, value, gasCost, mode: form.mode, quoteIn, expectedTokens, minTokensOut, request });
      setStep("review");
    } catch (err) {
      if (err instanceof LaunchValidationError) setError(err.message);
      else {
        const d = describeLaunchError(err);
        if (d.kind === "economics_mismatch") setNotice(d.message);
        setError(d.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function signAndSend() {
    if (!review || !walletClient || !publicClient || !prepared) return;
    setError(null);
    setStep("signing");
    let sent: Hex | null = null;
    try {
      // The user signs in their own wallet. Aestrodom never sees keys.
      const hash = await walletClient.writeContract(review.request as Parameters<typeof walletClient.writeContract>[0]);
      sent = hash;
      setTxHash(hash);
      setStep("confirming");
      const hint = {
        transactionHash: hash,
        name: review.params.name,
        symbol: review.params.symbol,
        launchConfigId: review.launchConfigId,
        creatorFeeRecipient: review.params.creatorFeeRecipient,
        creatorTaxBps: review.params.creatorTaxBps,
        buybackEnabled: review.params.buybackEnabled,
      };
      await fetch(`/api/projects/${projectId}/token/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(hint) }).catch(() => undefined);

      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (receipt.status !== "success") throw new Error("The launch transaction reverted.");
      const ev = parseTokenLaunched(receipt.logs, prepared.deployment.factory);
      if (!ev) throw new Error("Launch event not found in the transaction receipt.");
      setLaunched({ token: ev.token, curve: ev.curve });

      // Server re-verifies from the chain and links the token to the project.
      const res = await fetch(`/api/projects/${projectId}/token/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(hint) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) throw new Error(data.error ?? "Could not save the launch.");
      setStep("success");
      onLaunched({ tokenAddress: ev.token, curveAddress: ev.curve, transactionHash: hash, symbol: review.params.symbol });
    } catch (err) {
      const d = describeLaunchError(err);
      if (d.kind === "economics_mismatch" && !sent) {
        setNotice(d.message);
        setStep("form");
        await prepareReview();
        return;
      }
      setError(err instanceof Error && !("shortMessage" in err) ? err.message : d.message);
      setStep(sent ? "confirming" : "review");
    }
  }

  /** Free launch: the holder signs a message (no gas), Aestrodom's sponsor wallet sends the transaction. */
  async function claimFree() {
    if (!walletClient || !address || !prepared) return;
    setError(null);
    setStep("signing");
    try {
      const issuedAt = new Date().toISOString();
      const signature = await walletClient.signMessage({ account: address, message: freeLaunchMessage(projectId, address, issuedAt) });
      setStep("confirming");
      const res = await fetch(`/api/projects/${projectId}/token/sponsored`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          issuedAt,
          signature,
          name: form.name,
          symbol: form.symbol,
          logo: form.logo,
          description: form.description,
          twitter: form.twitter,
          telegram: form.telegram,
          discord: form.discord,
          creatorTaxBps: form.creatorTaxBps,
          launchConfigId: form.configId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) throw new Error(data.error ?? "Could not launch your token.");
      let l = data.launch as { status: string; tokenAddress: string | null; curveAddress: string | null; transactionHash: string; symbol: string; error: string | null };
      setTxHash(l.transactionHash as Hex);
      // Wait until the server has verified the launch on chain.
      for (let i = 0; l.status === "PENDING" && i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const t = await fetch(`/api/projects/${projectId}/token`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (t?.launch) l = t.launch;
      }
      if (l.status === "FAILED") throw new Error(l.error ?? "The launch failed.");
      if (l.status !== "LAUNCHED" || !l.tokenAddress || !l.curveAddress) throw new Error("Still confirming on Robinhood Chain. Check the token tab in a minute.");
      setLaunched({ token: l.tokenAddress, curve: l.curveAddress });
      setLaunchedSymbol(l.symbol);
      setStep("success");
      onLaunched({ tokenAddress: l.tokenAddress, curveAddress: l.curveAddress, transactionHash: l.transactionHash, symbol: l.symbol });
    } catch (err) {
      const d = describeLaunchError(err);
      const msg = err instanceof Error && !("shortMessage" in err) ? err.message : d.message;
      setError(d.kind === "rejected" ? "Signature rejected." : msg);
      setStep((s) => (s === "signing" ? "form" : s));
    }
  }

  // Slider range: Aestrodom policy (1–4%), never above the protocol's on-chain maximum.
  const taxMax = prepared ? Math.min(CREATOR_TAX_POLICY.maxBps, prepared.maxCreatorTaxBps) : CREATOR_TAX_POLICY.maxBps;
  const taxMin = CREATOR_TAX_POLICY.minBps;
  const taxUnavailable = taxMax < taxMin;
  const taxTooHigh = form.creatorTaxBps > taxMax || form.creatorTaxBps < taxMin;

  return (
    <Dialog open={open} onOpenChange={(o) => step !== "signing" && step !== "confirming" && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Launch Token</DialogTitle>
          <DialogDescription>Turn your project into a token on Pons V2 · Robinhood Chain.</DialogDescription>
        </DialogHeader>

        {loadError && <Alert>{loadError}</Alert>}
        {!prepared && !loadError && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted"><Loader2 className="size-4 animate-spin text-fg" /> Reading Pons V2 configuration…</div>
        )}

        {prepared && step === "form" && (
          <div className="space-y-5">
            {notice && <Alert tone="warning">{notice}</Alert>}
            {!prepared.launchEnabled && prepared.canLaunch === false && <Alert>Token launching is currently unavailable for this wallet.</Alert>}
            {holdsPass && (
              <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <Gift className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-semibold">Aestrodom Pass{pass!.passes!.length > 1 ? ` ×${pass!.passes!.length}` : ""}</div>
                    {freeAvailable ? (
                      <p className="text-muted">
                        You have {pass!.freeLaunchesLeft} free launch{pass!.freeLaunchesLeft === 1 ? "" : "es"} today. Aestrodom pays the launch fee and gas; creator fees go to your wallet.
                      </p>
                    ) : (
                      <p className="text-muted">
                        {!pass!.sponsorReady
                          ? "Free launches are not available right now."
                          : (pass!.freeLaunchesLeft ?? 0) === 0
                            ? "Today's free launch is used. It resets at 00:00 UTC."
                            : "Today's free launches are all claimed. Try again after 00:00 UTC."}
                      </p>
                    )}
                  </div>
                  {freeAvailable && (
                    <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      <input type="checkbox" checked={useFree} onChange={(e) => setUseFree(e.target.checked)} className="accent-[var(--accent)]" /> Use
                    </label>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
              <Field label="Token Name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={64} /></Field>
              <Field label="Token Symbol"><Input value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={16} /></Field>
            </div>
            <Field label="Token Logo" hint="Stored on IPFS via Pinata">
              <LogoUpload projectId={projectId} value={form.logo} onChange={(v) => set("logo", v)} />
            </Field>
            <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={2048} /></Field>
            <Field label="Website"><Input value={form.website} readOnly className="font-mono text-[13px] text-muted" /></Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="X / Twitter"><Input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="https://x.com/…" maxLength={256} /></Field>
              <Field label="Telegram"><Input value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="https://t.me/…" maxLength={256} /></Field>
              <Field label="Discord"><Input value={form.discord} onChange={(e) => set("discord", e.target.value)} placeholder="https://discord.gg/…" maxLength={256} /></Field>
            </div>
            <Field label="Creator Fee Recipient" hint={free ? "Free launches pay creator fees to your connected wallet" : "Defaults to your connected wallet"}>
              {free ? (
                <Input value={address ?? ""} readOnly className="font-mono text-[13px] text-muted" />
              ) : (
                <Input value={form.creatorFeeRecipient} onChange={(e) => set("creatorFeeRecipient", e.target.value.trim())} placeholder="0x…" className="font-mono text-[13px]" />
              )}
            </Field>
            <Field label="Creator Tax" hint="Paid to the creator fee recipient on every trade">
              {taxUnavailable ? (
                <p className="text-sm text-danger">The protocol currently allows at most {prepared.maxCreatorTaxBps / 100}% creator tax, below the 1% minimum.</p>
              ) : (
                <CreatorTaxSlider value={form.creatorTaxBps} min={taxMin} max={taxMax} step={CREATOR_TAX_POLICY.stepBps} onChange={(v) => set("creatorTaxBps", v)} />
              )}
            </Field>
            <Field label="Launch Configuration">
              <select
                value={form.configId}
                onChange={(e) => set("configId", Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              >
                {prepared.configs.map((c) => (
                  <option key={c.id} value={c.id} disabled={!c.enabled}>
                    #{c.id} · graduates at {trimEth(c.graduationThreshold)} ETH · {Number(c.curveFeeBps) / 100}% fee · supply {compact(formatUnits(BigInt(c.supply), 18))}
                    {!c.enabled ? " (disabled)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {canLaunchAndBuy && !free && (
              <Field label="Launch Mode">
                <RadioGroup value={form.mode} onValueChange={(v) => set("mode", v as "launch" | "launch_buy")} className="flex gap-6 pt-1">
                  <label className="flex items-center gap-2 text-sm"><RadioItem value="launch" /> Launch Only</label>
                  <label className="flex items-center gap-2 text-sm"><RadioItem value="launch_buy" /> Launch + Buy</label>
                </RadioGroup>
              </Field>
            )}
            {form.mode === "launch_buy" && !free && (
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-bg p-4">
                <Field label="Amount (ETH)"><Input type="number" min={0} step={0.01} value={form.buyAmount} onChange={(e) => set("buyAmount", e.target.value)} /></Field>
                <Field label="Slippage (%)"><Input type="number" min={0.1} max={50} step={0.1} value={form.slippagePct} onChange={(e) => set("slippagePct", e.target.value)} /></Field>
                <div className="col-span-2 space-y-1 text-xs text-muted">
                  <div className="flex justify-between"><span>Expected tokens</span><span className="text-fg">{buyQuote ? compact(formatUnits(buyQuote.expectedTokens, 18)) : "—"}</span></div>
                  <div className="flex justify-between"><span>Minimum tokens</span><span className="text-fg">{buyQuote ? compact(formatUnits(buyQuote.minTokensOut, 18)) : "—"}</span></div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted">Launch Fee</span>
              {free ? (
                <span className="font-mono"><span className="mr-2 text-subtle line-through">{formatEther(BigInt(prepared.launchFee))} ETH</span>Free</span>
              ) : (
                <span className="font-mono">{formatEther(BigInt(prepared.launchFee))} ETH</span>
              )}
            </div>

            {error && <Alert>{error}</Alert>}

            <WalletBar
              isConnected={isConnected}
              address={address}
              balance={balance ? `${Number(formatEther(balance.value)).toFixed(4)} ETH` : undefined}
              wrongChain={wrongChain}
              connectors={connectors.map((c) => ({ id: c.id, name: c.name, connect: () => connect({ connector: c, chainId: ROBINHOOD_CHAIN_ID }) }))}
              connecting={connecting}
              connectError={connectError?.message}
              switching={switching}
              onSwitch={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })}
              onDisconnect={() => disconnect()}
            />

            {free ? (
              <Button className="w-full" size="lg" variant="accent" onClick={claimFree} disabled={!isConnected || taxTooHigh || taxUnavailable || !walletClient || !form.name || !form.symbol}>
                <Gift /> Launch for free
              </Button>
            ) : (
              <Button className="w-full" size="lg" variant="accent" onClick={prepareReview} loading={busy} disabled={!isConnected || wrongChain || taxTooHigh || taxUnavailable || !walletClient}>
                Review Launch
              </Button>
            )}
          </div>
        )}

        {prepared && review && (step === "review" || step === "signing") && (
          <div className="space-y-4">
            {notice && <Alert tone="warning">{notice}</Alert>}
            <div className="divide-y divide-border rounded-xl border border-border bg-bg text-sm">
              <ReviewRow k="Token" v={`${review.params.name} ($${review.params.symbol})`} />
              <ReviewRow k="Website" v={review.params.socials.website} mono />
              <ReviewRow k="Creator fee recipient" v={shortAddress(review.params.creatorFeeRecipient, 6)} mono />
              <ReviewRow k="Creator tax" v={`${review.params.creatorTaxBps / 100}%`} />
              <ReviewRow k="Launch configuration" v={`#${review.launchConfigId}`} />
              <ReviewRow k="Pinned economics" v={shortAddress(review.economics, 6)} mono />
              <ReviewRow k="Launch fee" v={`${formatEther(review.launchFee)} ETH`} mono />
              {review.mode === "launch_buy" && (
                <>
                  <ReviewRow k="Initial buy" v={`${formatEther(review.quoteIn)} ETH`} mono />
                  <ReviewRow k="Min tokens out" v={compact(formatUnits(review.minTokensOut, 18))} mono />
                </>
              )}
              <ReviewRow k="Est. network fee" v={`≤ ${Number(formatEther(review.gasCost)).toFixed(6)} ETH`} mono />
              <ReviewRow k="Total" v={`${formatEther(review.value)} ETH + gas`} mono strong />
            </div>
            <p className="flex items-start gap-2 text-xs text-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-fg" />
              Simulated against Robinhood Chain. You will sign this transaction in your own wallet; Aestrodom never holds your keys or funds.
            </p>
            {error && <Alert>{error}</Alert>}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep("form")} disabled={step === "signing"}>Back</Button>
              <Button className="flex-1" variant="accent" size="lg" onClick={signAndSend} loading={step === "signing"}>
                {step === "signing" ? "Confirm in your wallet…" : "Launch Token"}
              </Button>
            </div>
          </div>
        )}

        {step === "signing" && !review && (
          <div className="space-y-3 py-6 text-center">
            <Loader2 className="mx-auto size-6 animate-spin text-fg" />
            <p className="text-sm">Sign the message in your wallet. It is free and sends no transaction.</p>
          </div>
        )}

        {step === "confirming" && (
          <div className="space-y-4 py-4 text-center">
            <Loader2 className="mx-auto size-6 animate-spin text-fg" />
            <p className="text-sm">{review ? "Transaction submitted. Waiting for confirmation…" : "Aestrodom is launching your token. Waiting for confirmation…"}</p>
            {txHash && (
              <a href={explorerTx(txHash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-fg">
                {shortAddress(txHash, 8)} <ExternalLink className="size-3" />
              </a>
            )}
            {error && <Alert>{error}</Alert>}
          </div>
        )}

        {step === "success" && launched && (review || launchedSymbol) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success"><Check className="size-5" /> ${review?.params.symbol ?? launchedSymbol} is live on Pons V2</div>
            <div className="divide-y divide-border rounded-xl border border-border bg-bg text-sm">
              <ReviewRow k="Token" v={shortAddress(launched.token, 6)} mono />
              <ReviewRow k="Curve" v={shortAddress(launched.curve, 6)} mono />
              {txHash && <ReviewRow k="Transaction" v={shortAddress(txHash, 6)} mono />}
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>View token dashboard</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WalletBar(props: {
  isConnected: boolean;
  address?: string;
  balance?: string;
  wrongChain: boolean;
  connectors: { id: string; name: string; connect: () => void }[];
  connecting: boolean;
  connectError?: string;
  switching: boolean;
  onSwitch: () => void;
  onDisconnect: () => void;
}) {
  if (!props.isConnected) {
    return (
      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="flex items-center gap-2 text-sm text-muted"><Wallet className="size-4" /> Connect Wallet</div>
        <div className="flex flex-wrap gap-2">
          {props.connectors.map((c) => (
            <Button key={c.id} size="sm" variant="secondary" onClick={c.connect} disabled={props.connecting}>{c.name}</Button>
          ))}
        </div>
        {props.connectError && <p className="text-xs text-danger">{props.connectError.split("\n")[0]}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-success" />
        <span className="font-mono text-[13px]">{shortAddress(props.address)}</span>
        {props.balance && <span className="text-xs text-muted">{props.balance}</span>}
      </div>
      <div className="flex items-center gap-2">
        {props.wrongChain ? (
          <Button size="sm" variant="accent" onClick={props.onSwitch} loading={props.switching}>Switch to Robinhood Chain</Button>
        ) : (
          <span className="text-xs text-muted">Robinhood Chain</span>
        )}
        <button onClick={props.onDisconnect} className="text-xs text-subtle hover:text-fg">Disconnect</button>
      </div>
    </div>
  );
}

/** 1%–4% creator tax slider (0.1% steps), keyboard accessible via the native range input. */
function CreatorTaxSlider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / Math.max(1, max - min)) * 100;
  const ticks = Array.from({ length: Math.floor((max - min) / 100) + 1 }, (_, i) => min + i * 100);
  return (
    <div className="border border-border px-4 pb-3 pt-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-mono text-[26px] font-medium tabular-nums tracking-tight">{(value / 100).toFixed(1)}%</span>
        <span className="text-[12px] text-subtle">{min / 100}% – {max / 100}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Creator tax"
        aria-valuetext={`${(value / 100).toFixed(1)} percent`}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-elevated accent-fg [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-fg [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg"
        style={{ background: `linear-gradient(to right, var(--fg) ${pct}%, var(--elevated) ${pct}%)` }}
      />
      <div className="mt-2 flex justify-between font-mono text-[11px] text-subtle">
        {ticks.map((t) => (
          <button key={t} type="button" onClick={() => onChange(t)} className="hover:text-fg">{t / 100}%</button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-muted">{k}</span>
      <span className={`${mono ? "font-mono text-[12.5px]" : ""} ${strong ? "font-semibold" : ""} truncate text-right`}>{v}</span>
    </div>
  );
}

function Alert({ children, tone = "danger" }: { children: React.ReactNode; tone?: "danger" | "warning" }) {
  const c = tone === "danger" ? "border-danger/25 bg-danger/5 text-danger" : "border-warning/25 bg-warning/5 text-warning";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${c}`} role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span>{children}</span>
    </div>
  );
}

function trimEth(wei: string) {
  return Number(formatEther(BigInt(wei))).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function compact(n: string) {
  return Number(n).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });
}
