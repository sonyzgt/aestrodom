import { currentUserOrRedirect } from "@/lib/session";
import { prisma } from "@/lib/db";
import { planLimits } from "@/lib/plans";
import { billingConfig, orderJson } from "@/lib/billing/orders";
import { HopText } from "@/components/motion/hop-text";
import { Billing } from "@/components/dashboard/billing";

export const metadata = { title: "Credits & API" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await currentUserOrRedirect();
  const [u, orders, keys] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { credits: true } }),
    prisma.creditOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.apiKey.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const limits = planLimits(user.plan);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <div className="shimmer text-[12px] font-medium tracking-[0.02em]">Billing</div>
        <HopText as="h1" trigger="load" text="Credits & API" className="mt-1 text-[clamp(1.7rem,3vw,2.3rem)] font-black tracking-[-0.03em]" />
        <p className="mt-2 max-w-[640px] text-[14px] text-muted">
          Your plan includes {limits.maxAiRequestsPerDay} free AI runs a day in the builder. Credits keep you building past that, and power every request made with an API key.
        </p>
      </div>
      <Billing
        initialCredits={u.credits}
        config={billingConfig()}
        initialOrders={orders.map(orderJson)}
        initialKeys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))}
      />
    </div>
  );
}
