"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { erc20Abi, formatUnits, type Hex, type PublicClient } from "viem";
import { useAccount, useConnect, useDisconnect, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from "wagmi";
import { Check, Copy, ExternalLink, KeyRound, Loader2, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletProviders } from "@/components/wallet/providers";
import { ROBINHOOD_CHAIN_ID, explorerTx } from "@/lib/chains/robinhood";
import { shortAddress } from "@/lib/utils";
import type { BillingConfig } from "@/lib/billing/orders";

interface Order {
  id: string;
  credits: number;
  usd: number;
  amount: string;
  status: string;
  txHash: string | null;
  expiresAt: string;
  createdAt: string;
}

interface Key {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

const fmtToken = (wei: string | bigint) => Number(formatUnits(BigInt(wei), 18)).toLocaleString("en-US", { maximumFractionDigits: 4 });

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Something went wrong."), { code: data.code as string | undefined });
  return data as T;
}

export function Billing(props: { initialCredits: number; config: BillingConfig; initialOrders: Order[]; initialKeys: Key[] }) {
  return (
    <WalletProviders>
      <BillingInner {...props} />
    </WalletProviders>
  );
}

function BillingInner({ initialCredits, config, initialOrders, initialKeys }: { initialCredits: number; config: BillingConfig; initialOrders: Order[]; initialKeys: Key[] }) {
  const router = useRouter();
  const [credits, setCredits] = useState(initialCredits);
  const [orders, setOrders] = useState(initialOrders);

  async function refresh() {
    const data = await api<{ credits: number; orders: Order[] }>("/api/billing");
    setCredits(data.credits);
    setOrders(data.orders);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="panel flex flex-wrap items-end justify-between gap-6 rounded-3xl p-6">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Credit balance</div>
          <div className={`mt-2 text-[44px] font-black leading-none tabular-nums ${credits < 0 ? "text-danger" : ""}`}>{credits.toLocaleString("en-US")}</div>
          <p className="mt-2 max-w-[520px] text-[12.5px] text-subtle">
            Each AI run is charged at what Claude actually costs for it, plus {config.marginPercent}%. 1 credit = ${(1 / Math.max(1, config.creditsPerUsd)).toFixed(2)}. Bigger changes use more.
          </p>
        </div>
        {config.enabled && (
          <div className="text-right text-[12.5px] text-subtle">
            $1 = {config.creditsPerUsd.toLocaleString("en-US")} credits
            <br />
            Paid in $AESTRODOM on Robinhood Chain
          </div>
        )}
      </section>

      <BuyCredits config={config} onPaid={refresh} />
      {orders.length > 0 && <Orders orders={orders} onPaid={refresh} />}
      <ApiKeys initialKeys={initialKeys} />
      <ApiDocs />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buying                                                              */
/* ------------------------------------------------------------------ */

type Stage = "idle" | "ordering" | "signing" | "confirming" | "done";

interface Quote {
  usd: number;
  credits: number;
  amount: string;
  tokenUsd: number;
}

function BuyCredits({ config, onPaid }: { config: BillingConfig; onPaid: () => Promise<void> }) {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID }) as PublicClient | undefined;
  const { data: walletClient } = useWalletClient({ chainId: ROBINHOOD_CHAIN_ID });
  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: config.token as Hex,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: !!address && config.enabled },
  });

  const [usdInput, setUsdInput] = useState(String(config.options[0] ?? config.minUsd));
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [locked, setLocked] = useState<Order | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<Hex | null>(null);

  const usd = Number(usdInput);
  const validUsd = usdInput.trim() !== "" && Number.isFinite(usd) && usd >= config.minUsd && usd <= config.maxUsd;

  // Live preview: how many tokens the amount costs right now. Refreshed every 30 s.
  useEffect(() => {
    if (!config.enabled) return;
    setQuote(null);
    setQuoteError(null);
    if (!validUsd) return;
    let alive = true;
    const load = () =>
      api<Quote>(`/api/billing/quote?usd=${usd}`)
        .then((q) => {
          if (alive) setQuote(q);
        })
        .catch((err) => {
          if (alive) setQuoteError(err instanceof Error ? err.message : String(err));
        });
    const t = setTimeout(load, 350);
    const i = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(i);
    };
  }, [usd, validUsd, config.enabled]);

  if (!config.enabled) {
    return (
      <section className="panel rounded-3xl p-6">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Top up</div>
        <p className="mt-3 text-[14px] text-muted">Top-ups with $AESTRODOM open soon.</p>
      </section>
    );
  }

  const wrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;
  const busy = stage === "ordering" || stage === "signing" || stage === "confirming";

  async function buy() {
    if (!walletClient || !publicClient || !address || !validUsd) return;
    setError(null);
    setTx(null);
    setLocked(null);
    try {
      // The server re-quotes and locks the token amount for 15 minutes.
      setStage("ordering");
      const { order } = await api<{ order: Order }>("/api/billing/orders", { method: "POST", body: JSON.stringify({ usd }) });
      setLocked(order);
      if (tokenBalance !== undefined && tokenBalance < BigInt(order.amount)) {
        throw new Error(`Not enough $AESTRODOM in ${shortAddress(address)}. You need ${fmtToken(order.amount)}.`);
      }

      // The exact amount (with its dust) is what ties this payment to the order.
      setStage("signing");
      const { request } = await publicClient.simulateContract({
        address: config.token as Hex,
        abi: erc20Abi,
        functionName: "transfer",
        args: [config.treasury as Hex, BigInt(order.amount)],
        account: address,
      });
      const hash = await walletClient.writeContract(request as Parameters<typeof walletClient.writeContract>[0]);
      setTx(hash);

      setStage("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (receipt.status !== "success") throw new Error("The payment transaction failed.");
      await confirmWithRetry(order.id, hash);
      setStage("done");
      await Promise.all([onPaid(), refetchBalance()]);
    } catch (err) {
      setStage("idle");
      const msg = err instanceof Error ? err.message : String(err);
      setError(/user (rejected|denied)/i.test(msg) ? "You cancelled the transaction in your wallet." : msg.split("\n")[0]!);
      await onPaid().catch(() => undefined);
    }
  }

  return (
    <section className="panel rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Top up</div>
        {isConnected && address && (
          <div className="flex items-center gap-3 text-[12.5px] text-subtle">
            <span className="font-mono">{shortAddress(address)}</span>
            {tokenBalance !== undefined && <span>{fmtToken(tokenBalance)} $AESTRODOM</span>}
            <button type="button" onClick={() => disconnect()} className="underline underline-offset-4 hover:text-fg">
              Disconnect
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {config.options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={busy}
            onClick={() => setUsdInput(String(o))}
            className={`h-10 rounded-md border px-4 text-[14px] font-semibold tabular-nums transition-colors ${usd === o ? "border-fg bg-fg text-bg" : "border-border hover:border-fg"}`}
          >
            ${o}
          </button>
        ))}
        <div className="flex h-10 items-center rounded-md border border-border pl-3 focus-within:border-fg">
          <span className="text-[14px] text-subtle">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={config.minUsd}
            max={config.maxUsd}
            step="1"
            value={usdInput}
            disabled={busy}
            onChange={(e) => setUsdInput(e.target.value)}
            aria-label="Top-up amount in USD"
            className="h-full w-24 bg-transparent px-2 text-[14px] font-semibold tabular-nums outline-none"
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border p-4">
        {!validUsd ? (
          <p className="text-[13px] text-danger">
            Enter an amount between ${config.minUsd} and ${config.maxUsd}.
          </p>
        ) : quote ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[12px] uppercase tracking-[0.14em] text-subtle">You pay</div>
              <div className="mt-1 text-[22px] font-black tabular-nums">≈ {fmtToken(quote.amount)} $AESTRODOM</div>
              <div className="mt-1 text-[12.5px] text-subtle">1 $AESTRODOM ≈ ${quote.tokenUsd.toPrecision(3)} · live price from the Pons curve</div>
            </div>
            <div className="text-right">
              <div className="text-[12px] uppercase tracking-[0.14em] text-subtle">You get</div>
              <div className="mt-1 text-[22px] font-black tabular-nums">{quote.credits.toLocaleString("en-US")} credits</div>
            </div>
          </div>
        ) : quoteError ? (
          <p className="text-[13px] text-danger">{quoteError}</p>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-subtle">
            <Loader2 className="size-4 animate-spin" /> Checking the live price…
          </p>
        )}
      </div>

      {isConnected && !wrongChain && (
        <Button className="mt-4" size="lg" disabled={!validUsd || !quote || busy} loading={busy} onClick={buy}>
          Pay ${validUsd ? usd : "—"} in $AESTRODOM
        </Button>
      )}
      {!isConnected && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Wallet className="size-4 text-subtle" />
          <span className="mr-1 text-[13px] text-muted">Connect a wallet holding $AESTRODOM:</span>
          {connectors.map((c) => (
            <Button key={c.uid} size="sm" variant="secondary" disabled={connecting} onClick={() => connect({ connector: c, chainId: ROBINHOOD_CHAIN_ID })}>
              {c.name}
            </Button>
          ))}
          {connectError && <p className="w-full text-[12.5px] text-danger">{connectError.message.split("\n")[0]}</p>}
        </div>
      )}
      {wrongChain && (
        <div className="mt-5 flex items-center gap-3 text-[13px] text-muted">
          Your wallet is on another network.
          <Button size="sm" variant="secondary" loading={switching} onClick={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })}>
            Switch to Robinhood Chain
          </Button>
        </div>
      )}

      {stage !== "idle" && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px]">
          {stage === "done" ? <Check className="size-4 text-success" /> : <Loader2 className="size-4 animate-spin" />}
          {stage === "ordering" && "Locking the price…"}
          {stage === "signing" && locked && `Price locked: send ${fmtToken(locked.amount)} $AESTRODOM. Confirm the transfer in your wallet…`}
          {stage === "confirming" && "Waiting for Robinhood Chain to confirm…"}
          {stage === "done" && locked && `${locked.credits.toLocaleString("en-US")} credits added.`}
          {tx && (
            <a href={explorerTx(tx)} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-1 text-subtle underline underline-offset-4 hover:text-fg">
              View transaction <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
      {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
      <p className="mt-5 text-[12px] text-subtle">
        When you press Pay, the price is locked for 15 minutes. Pay only from this page: the amount includes a tiny unique tail that matches the payment
        to your order. Payments go to {shortAddress(config.treasury ?? "")}. Credits are non-refundable.
      </p>
    </section>
  );
}

/** Confirms an order, retrying while the RPC behind the server hasn't seen the transaction yet. */
async function confirmWithRetry(orderId: string, txHash: string) {
  for (let i = 0; ; i++) {
    try {
      return await api(`/api/billing/orders/${orderId}/confirm`, { method: "POST", body: JSON.stringify({ txHash }) });
    } catch (err) {
      if ((err as { code?: string }).code !== "tx_pending" || i >= 10) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

function Orders({ orders, onPaid }: { orders: Order[]; onPaid: () => Promise<void> }) {
  return (
    <section className="panel overflow-hidden rounded-3xl">
      <div className="px-6 pb-2 pt-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Orders</div>
      <ul>
        {orders.map((o) => (
          <OrderRow key={o.id} order={o} onPaid={onPaid} />
        ))}
      </ul>
    </section>
  );
}

function OrderRow({ order, onPaid }: { order: Order; onPaid: () => Promise<void> }) {
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unpaid = order.status !== "PAID";

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await confirmWithRetry(order.id, hash.trim());
      await onPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-t border-border px-6 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px]">
        <span className="font-semibold tabular-nums">${order.usd}</span>
        <span className="tabular-nums">{order.credits.toLocaleString("en-US")} credits</span>
        <span className="text-subtle">{fmtToken(order.amount)} $AESTRODOM</span>
        <span className="text-subtle">{new Date(order.createdAt).toLocaleString()}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${order.status === "PAID" ? "bg-success/15 text-success" : "bg-elevated text-subtle"}`}>
          {order.status.toLowerCase()}
        </span>
        {order.txHash && (
          <a href={explorerTx(order.txHash)} target="_blank" rel="noopener noreferrer" className="text-subtle hover:text-fg" aria-label="View transaction">
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      {unpaid && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input value={hash} onChange={(e) => setHash(e.target.value)} placeholder="Already paid? Paste the transaction hash (0x…)" className="h-8 min-w-[260px] flex-1 font-mono text-[12.5px]" />
          <Button size="sm" variant="secondary" disabled={!/^0x[0-9a-fA-F]{64}$/.test(hash.trim())} loading={busy} onClick={claim}>
            Check payment
          </Button>
          {error && <p className="w-full text-[12.5px] text-danger">{error}</p>}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* API keys                                                            */
/* ------------------------------------------------------------------ */

function ApiKeys({ initialKeys }: { initialKeys: Key[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ key: string; apiKey: Key }>("/api/keys", { method: "POST", body: JSON.stringify({ name: name.trim() || "Default" }) });
      setKeys((k) => [data.apiKey, ...k]);
      setCreated(data.key);
      setCopied(false);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await api(`/api/keys/${id}`, { method: "DELETE" });
      setKeys((k) => k.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      // Clipboard blocked: the key is still selectable.
    }
  }

  return (
    <section className="panel rounded-3xl p-6">
      <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">API keys</div>
      <p className="mt-2 text-[13.5px] text-muted">Use a key to create apps, run Claude and deploy from your own scripts and tools. Requests made with a key always spend credits.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name, e.g. My bot" maxLength={60} className="h-9 min-w-[220px] flex-1" />
        <Button onClick={create} loading={busy}>
          <KeyRound /> Create key
        </Button>
      </div>

      {created && (
        <div className="mt-4 rounded-2xl border border-fg/30 bg-elevated p-4">
          <div className="text-[12.5px] font-semibold">Copy your key now. You won&apos;t be able to see it again.</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-md bg-bg px-3 py-2 font-mono text-[12.5px]">{created}</code>
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      {keys.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[13.5px]">
              <span className="font-semibold">{k.name}</span>
              <code className="font-mono text-[12.5px] text-subtle">{k.prefix}…</code>
              <span className="text-[12.5px] text-subtle">{k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => revoke(k.id)}>
                <Trash2 /> Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApiDocs() {
  const [origin, setOrigin] = useState("https://aestrodom.org");
  useEffect(() => setOrigin(window.location.origin), []);
  const h = `-H "Authorization: Bearer $AESTRODOM_KEY"`;
  const snippets: [string, string][] = [
    ["Check your key and balance", `curl ${origin}/api/me ${h}`],
    ["Create an app from a prompt", `curl -X POST ${origin}/api/projects ${h} \\\n  -H "content-type: application/json" \\\n  -d '{"prompt":"A landing page for my coffee shop"}'`],
    ["Let Claude build it (streams progress as NDJSON)", `curl -N -X POST ${origin}/api/projects/PROJECT_ID/ai ${h} \\\n  -H "content-type: application/json" -d '{"initial":true}'`],
    ["Ask for a change", `curl -N -X POST ${origin}/api/projects/PROJECT_ID/ai ${h} \\\n  -H "content-type: application/json" -d '{"prompt":"Make the header dark"}'`],
    ["Deploy it", `curl -X POST ${origin}/api/projects/PROJECT_ID/deploy ${h} \\\n  -H "content-type: application/json" -d '{}'`],
  ];
  return (
    <section className="panel rounded-3xl p-6">
      <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Quick start</div>
      <div className="mt-4 space-y-4">
        {snippets.map(([title, code]) => (
          <div key={title}>
            <div className="mb-1.5 text-[13px] font-semibold">{title}</div>
            <pre className="overflow-x-auto rounded-xl bg-elevated px-4 py-3 font-mono text-[12px] leading-relaxed">{code}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}
