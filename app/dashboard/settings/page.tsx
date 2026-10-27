import { currentUserOrRedirect } from "@/lib/session";
import { prisma } from "@/lib/db";
import { planLimits } from "@/lib/plans";
import { aiUsageToday } from "@/lib/ai/usage";
import { shortAddress } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import { Gauge } from "@/components/dashboard/gauge";
import { HopText } from "@/components/motion/hop-text";

export const metadata = { title: "Account" };

export default async function SettingsPage() {
  const user = await currentUserOrRedirect();
  const limits = planLimits(user.plan);
  const [usage, projects] = await Promise.all([aiUsageToday(user.id), prisma.project.count({ where: { userId: user.id } })]);
  const initial = (user.name || user.email || "C").charAt(0).toUpperCase();
  const plan = user.plan === "PRO" ? "Pro" : "Free";

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <div className="text-[12px] shimmer font-medium tracking-[0.02em]">Account</div>
        <HopText as="h1" trigger="load" text="Account & usage" className="mt-1 text-[clamp(1.7rem,3vw,2.3rem)] font-black tracking-[-0.03em]" />
      </div>

      <div className="grid gap-5 md:grid-cols-[320px_1fr]">
        {/* Identity card */}
        <section className="panel flex flex-col items-center rounded-3xl p-6 text-center">
          <span className="grid size-20 place-items-center rounded-2xl bg-[image:var(--primary)] text-[32px] font-black text-[color:var(--on-primary)]">
            {initial}
          </span>
          <div className="mt-4 text-[18px] font-bold tracking-tight">{user.name ?? "Unnamed builder"}</div>
          <div className="text-[13px] text-subtle">{user.email ?? "Signed in with Privy"}</div>
          <span className="btn-primary mt-4 rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">{plan} plan</span>
          <div className="mt-6 w-full">
            <LogoutButton />
          </div>
        </section>

        <div className="space-y-5">
          <section className="panel rounded-3xl p-6">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Usage</div>
            <div className="mt-4 flex flex-wrap justify-around gap-6">
              <Gauge used={usage.requests} max={limits.maxAiRequestsPerDay} label="AI runs today" size={128} />
              <Gauge used={projects} max={limits.maxProjects} label="Apps" size={128} />
            </div>
            <p className="mt-4 text-center text-[12px] text-subtle">Daily limits reset at 00:00 UTC.</p>
          </section>

          <section className="panel overflow-hidden rounded-3xl">
            <dl className="grid sm:grid-cols-2">
              <Field label="Display name" value={user.name ?? "—"} />
              <Field label="Email" value={user.email ?? "—"} />
              <Field label="Wallet" value={user.walletAddress ? shortAddress(user.walletAddress) : "Not connected"} mono />
              <Field label="Storage per app" value={`${Math.round(limits.maxProjectSizeBytes / 1024 / 1024)} MB`} />
              <Field label="Member since" value={user.createdAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} />
              <Field label="Plan" value={plan} />
              <Field label="Credits" value={user.credits.toLocaleString("en-US")} />
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-border px-6 py-4 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className={`mt-1 truncate text-[14.5px] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
