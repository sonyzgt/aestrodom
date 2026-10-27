import { formatEther } from "viem";
import { currentUser } from "@/lib/session";
import { platformStats, ponsSnapshot } from "@/lib/stats";
import { explorerAddress } from "@/lib/chains/robinhood";
import { shortAddress } from "@/lib/utils";
import { baseDomain } from "@/lib/deployment/domain";
import { Landing, type Pricing, type TokenTerms } from "@/components/marketing/landing";
import { planLimits } from "@/lib/plans";
import { billingConfig } from "@/lib/billing/orders";
import { tokenPrice } from "@/lib/billing/price";

export const revalidate = 60;

export default async function Home() {
  const [user, stats, pons] = await Promise.all([currentUser(), platformStats(), ponsSnapshot()]);
  const cfg = pons?.config;

  // Live Pons V2 terms, formatted on the server so the client bundle stays free of chain helpers.
  const token: TokenTerms | null = pons
    ? {
        asOf: new Date(pons.asOf).toUTCString().replace("GMT", "UTC"),
        chainId: pons.chainId,
        launchFee: `${formatEther(BigInt(pons.launchFee))} ETH`,
        curveFee: cfg ? `${Number(cfg.curveFeeBps) / 100}%` : "—",
        supply: cfg ? Number(formatEther(BigInt(cfg.supply))).toLocaleString("en-US", { notation: "compact" }) : "—",
        graduation: cfg ? `${Number(formatEther(BigInt(cfg.graduationThreshold)))} ETH` : "—",
        config: cfg ? `#${cfg.id} of ${pons.configCount}` : "—",
        factory: shortAddress(pons.factory, 6),
        factoryUrl: explorerAddress(pons.factory),
        economics: pons.economics ? shortAddress(pons.economics, 6) : null,
      }
    : null;

  const free = planLimits("FREE");
  const billing = billingConfig();
  const live = billing.enabled ? await tokenPrice().catch(() => null) : null;
  const pricing: Pricing = {
    freeRunsPerDay: free.maxAiRequestsPerDay,
    freeProjects: free.maxProjects,
    creditsPerUsd: billing.enabled ? billing.creditsPerUsd : 0,
    options: billing.options,
    marginPercent: billing.marginPercent,
    tokenUsd: live ? live.tokenUsd.toPrecision(3) : null,
  };

  return <Landing signedIn={!!user} domain={baseDomain()} stats={stats} token={token} pricing={pricing} />;
}
