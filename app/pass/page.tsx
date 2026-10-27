import Image from "next/image";
import { currentUser } from "@/lib/session";
import { SiteHeader } from "@/components/marketing/site-header";
import { MintPanel } from "@/components/pass/mint-panel";

export const metadata = {
  title: "Aestrodom Pass",
  description: "500 free-mint passes on Robinhood Chain. Each pass gives one free token launch per day on Aestrodom.",
  openGraph: { images: ["/nft/aestrodom-pass.png"] },
};
export const dynamic = "force-dynamic";

const PERKS = [
  { k: "01", t: "One free launch every day", d: "Each pass gives one token launch per day. Aestrodom pays the Pons launch fee and the gas." },
  { k: "02", t: "Creator fees go to you", d: "The creator fee recipient is the wallet that holds the pass. Every creator fee from trading goes straight to it." },
  { k: "03", t: "500 passes, free mint", d: "One pass per wallet. You only pay the network fee to mint." },
];

export default async function PassPage() {
  const user = await currentUser();
  return (
    <div className="min-h-dvh">
      <SiteHeader signedIn={!!user} />
      <main className="mx-auto w-full max-w-[1280px] px-5 pb-24 pt-14 sm:px-8 sm:pt-20 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <div className="mx-auto w-full max-w-[600px] lg:sticky lg:top-24">
            <Image
              src="/nft/aestrodom-pass.png"
              alt="Aestrodom Pass card"
              width={1254}
              height={1254}
              priority
              className="h-auto w-full border border-border"
            />
          </div>
          <div className="space-y-8">
            <div>
              <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-subtle">NFT · Robinhood Chain</div>
              <h1 className="mt-3 text-balance text-[clamp(2rem,6vw,3.5rem)] font-medium leading-[1.04] tracking-[-0.035em]">Aestrodom Pass</h1>
              <p className="prose-serif mt-4 max-w-xl">Hold a pass and launch your app&apos;s token for free, once a day. We pay the launch fee, you keep the creator fees.</p>
            </div>
            <MintPanel signedIn={!!user} />
            <div className="divide-y divide-border border-y border-border">
              {PERKS.map((p) => (
                <div key={p.k} className="flex gap-5 py-5">
                  <span className="font-mono text-[13px] text-subtle">{p.k}</span>
                  <div>
                    <div className="font-medium">{p.t}</div>
                    <p className="mt-1 text-sm text-muted">{p.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-subtle">
              Each pass gives one free launch per day, reset at 00:00 UTC. A free launch is launch only, without an opening buy.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
