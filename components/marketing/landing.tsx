"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronRight, Sparkles, X } from "lucide-react";
import { TOKEN_SYMBOL, X_HANDLE, X_URL } from "@/components/brand";
import { Corner, Frame } from "@/components/ui/corner";
import type { PlatformStats } from "@/lib/stats";

// Aestra, the brand character. The suit is always visible; the armour beneath shows only inside the cursor spotlight.
// Both renders share one pose and framing, so the reveal lines up. Upscaled 2x (lanczos + light sharpen) from the
// 1672px originals so 1920px and retina screens are not stretching them.
const BG_IMAGE_1 = "/landing/aestra-suit.webp?v=3";
const BG_IMAGE_2 = "/landing/aestra-armor.webp?v=3";

export interface TokenTerms {
  asOf: string;
  chainId: number;
  launchFee: string;
  curveFee: string;
  supply: string;
  graduation: string;
  config: string;
  factory: string;
  factoryUrl: string;
  economics: string | null;
}

/** Public pricing, formatted on the server. */
export interface Pricing {
  freeRunsPerDay: number;
  freeProjects: number;
  /** Credits per US dollar; 0 while buying is off. */
  creditsPerUsd: number;
  /** Preset top-up amounts in USD. */
  options: number[];
  /** Margin over the Claude cost per AI run, in percent. */
  marginPercent: number;
  /** Live USD price of one $AESTRODOM, formatted, or null if unavailable. */
  tokenUsd: string | null;
}

type Panel = "workflow" | "features" | "token" | "pricing" | "faq" | "start";

const NAV: { id: Exclude<Panel, "start">; label: string }[] = [
  { id: "workflow", label: "Workflow" },
  { id: "features", label: "Features" },
  { id: "token", label: "Token" },
  { id: "pricing", label: "API" },
  { id: "faq", label: "FAQ" },
];

const SUGGESTIONS = ["Portfolio for a photographer", "Coffee shop menu", "Meme coin landing page", "Habit tracker"];

/** Light landing page around the Aestra renders: one full-viewport composition, with the details in side drawers. */
export function Landing({
  signedIn,
  domain,
  stats,
  token,
  pricing,
}: {
  signedIn: boolean;
  domain: string;
  stats: PlatformStats | null;
  token: TokenTerms | null;
  pricing: Pricing;
}) {
  const [panel, setPanel] = useState<Panel>("workflow");
  const [open, setOpen] = useState(false);

  const show = (p: Panel) => {
    setPanel(p);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className={`landing font-jakarta relative flex min-h-dvh flex-col justify-between overflow-hidden bg-white text-black antialiased`}
    >
      <ImageRevealBackground />
      <MobileBackdrop />

      {/* Header */}
      <header
        className="relative z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
        style={{ paddingInline: "var(--pad-x)", paddingTop: "var(--header-pt)", paddingBottom: "var(--section-gap)" }}
      >
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="font-orbitron flex items-start font-black transition-opacity hover:opacity-80"
          style={{ fontSize: "var(--logo)", letterSpacing: "0.15em" }}
        >
          AESTRODOM
          <span className="-mt-0.5 ml-0.5" style={{ fontSize: "var(--logo-deg)" }}>
            ˚
          </span>
        </Link>
        {/* Phones: account links stay beside the logo and the section links drop to a full-width row below. */}
        <nav
          className="order-last flex w-full items-center justify-between font-medium uppercase sm:order-none sm:w-auto sm:justify-start sm:gap-[var(--gap-nav)]"
          style={{ fontSize: "var(--nav)", letterSpacing: "0.2em" }}
        >
          {NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => show(n.id)} className="whitespace-nowrap py-1 uppercase transition-opacity hover:opacity-50">
              {n.label}
            </button>
          ))}
          <span aria-hidden className="hidden text-gray-500 sm:inline">
            |
          </span>
          <AccountLinks signedIn={signedIn} onStart={() => show("start")} className="hidden sm:flex" />
        </nav>
        <AccountLinks signedIn={signedIn} onStart={() => show("start")} className="flex sm:hidden" />
      </header>

      {/* Hero */}
      <main
        className="relative z-10 flex flex-1 flex-col justify-between gap-7 lg:flex-row lg:gap-10"
        style={{ paddingInline: "var(--pad-x)", paddingBlock: "var(--main-py)" }}
      >
        <div className="flex flex-col justify-center">
          <div className="mb-5 flex items-center gap-3 uppercase text-gray-600 lg:hidden" style={{ fontSize: "var(--micro)", letterSpacing: "0.24em" }}>
            <span className="h-px w-8 bg-black" />
            AI app builder · Robinhood Chain
          </div>
          <Corner pos="tl" />
          <h1
            className="font-orbitron my-[var(--section-gap)] font-extrabold uppercase"
            style={{ fontSize: "var(--headline)", letterSpacing: "0.08em", lineHeight: 1.05 }}
          >
            <span className="block">Build</span>
            <span className="block">Anything</span>
            <span className="flex items-center gap-[0.25em] whitespace-nowrap">
              With AI
              <Checker />
            </span>
          </h1>
          <Corner pos="bl" />
          <p className="mt-5 max-w-[22rem] leading-relaxed text-gray-600 lg:hidden" style={{ fontSize: "var(--body)" }}>
            Describe your idea in one sentence. Claude builds it, and it goes live on its own domain.
          </p>
          <div className="mt-[calc(var(--section-gap)*2)] flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Phones: solid, full-width primary; from lg the original outlined button. */}
            <button
              type="button"
              onClick={() => show("start")}
              className="group flex items-center justify-between rounded-md border border-black bg-black font-semibold uppercase text-white transition-colors hover:bg-white hover:text-black sm:w-fit sm:justify-start lg:border-gray-500 lg:bg-transparent lg:text-black lg:hover:border-black lg:hover:bg-black lg:hover:text-white"
              style={{ gap: "var(--btn-gap)", fontSize: "var(--body)", letterSpacing: "0.18em", paddingInline: "var(--btn-px)", paddingBlock: "var(--btn-py)" }}
            >
              Start building
              <ArrowUpRight strokeWidth={1.5} className="size-[1.2em] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => show("workflow")}
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 font-semibold uppercase text-gray-700 transition-colors hover:border-black hover:text-black sm:w-fit lg:hidden"
              style={{ fontSize: "var(--body)", letterSpacing: "0.18em", paddingInline: "var(--btn-px)", paddingBlock: "var(--btn-py)" }}
            >
              How it works
            </button>
          </div>
        </div>

        <div className="relative self-stretch sm:self-end lg:min-w-[var(--feature-min)]" style={{ padding: "var(--feature-pad)" }}>
          <Frame />
          <Globe />
          <p className="mt-[var(--section-gap)] font-semibold uppercase leading-relaxed" style={{ fontSize: "var(--body)", letterSpacing: "0.18em" }}>
            Describe it.
            <br />
            Live on its own domain.
          </p>
          {stats && (
            <>
              <p className="mt-2 hidden uppercase text-gray-600 lg:block" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
                {stats.projects.toLocaleString("en-US")} apps built · {stats.liveDeployments.toLocaleString("en-US")} live now
              </p>
              <dl className="mt-4 grid grid-cols-2 border-t border-gray-200 pt-4 lg:hidden">
                <MobileStat value={stats.projects} label="Apps built" />
                <MobileStat value={stats.liveDeployments} label="Live now" />
              </dl>
            </>
          )}
        </div>
      </main>

      {/* Phones: a quiet sign-off instead of the image. */}
      <footer
        className="relative z-10 flex items-center justify-between border-t border-gray-200 uppercase text-gray-500 lg:hidden"
        style={{ marginInline: "var(--pad-x)", paddingBlock: "var(--pad-y)", fontSize: "var(--micro)", letterSpacing: "0.2em" }}
      >
        <span>© {new Date().getFullYear()} Aestrodom</span>
        <a href={X_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-black">
          @{X_HANDLE}
        </a>
      </footer>

      <Drawer open={open} panel={panel} onClose={() => setOpen(false)}>
        {panel === "workflow" && <WorkflowPanel domain={domain} />}
        {panel === "features" && <FeaturesPanel domain={domain} />}
        {panel === "token" && <TokenPanel token={token} />}
        {panel === "pricing" && <PricingPanel pricing={pricing} signedIn={signedIn} />}
        {panel === "faq" && <FaqPanel domain={domain} />}
        {panel === "start" && <StartPanel signedIn={signedIn} />}
      </Drawer>
    </div>
  );
}

function AccountLinks({ signedIn, onStart, className }: { signedIn: boolean; onStart: () => void; className: string }) {
  return (
    <div className={`items-center font-medium uppercase ${className}`} style={{ gap: "var(--gap-nav)", fontSize: "var(--nav)", letterSpacing: "0.2em" }}>
      <Link href={signedIn ? "/dashboard" : "/login"} className="whitespace-nowrap transition-opacity hover:opacity-50">
        {signedIn ? "Dashboard" : "Sign in"}
      </Link>
      <button type="button" onClick={onStart} aria-label="Start a new project" className="transition-opacity hover:opacity-50">
        <Sparkles strokeWidth={1.5} style={{ width: "var(--icon)", height: "var(--icon)" }} />
      </button>
    </div>
  );
}

function MobileStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="pr-3">
      <dd className="font-orbitron font-bold tabular-nums" style={{ fontSize: "calc(var(--logo) * 1.1)" }}>
        {value.toLocaleString("en-US")}
      </dd>
      <dt className="mt-1 uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
        {label}
      </dt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive background                                              */
/* ------------------------------------------------------------------ */

/** Below lg: a faint grid that fades out toward the bottom, in place of the photo background. */
function MobileBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 lg:hidden"
      style={{
        backgroundImage: "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage: "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.5) 45%, transparent 85%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.5) 45%, transparent 85%)",
      }}
    />
  );
}

// The mask canvas is drawn at a fraction of the viewport; the gradient is soft, so upscaling is invisible.
const MASK_SCALE = 0.25;

/** Desktop only: BG_IMAGE_2 is revealed through a soft spotlight that trails the cursor, over a parallax grid. */
function ImageRevealBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const patternRef = useRef<SVGPatternElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const reveal = revealRef.current;
    const pattern = patternRef.current;
    const path = pathRef.current;
    if (!root || !reveal || !pattern || !path) return;
    // Skip the whole loop when the background is hidden (below lg).
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const smooth = { ...mouse };
    const grid = { x: 0, y: 0 };
    let last = { x: NaN, y: NaN };
    let frame = 0;

    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * MASK_SCALE));
      canvas.height = Math.max(1, Math.round(window.innerHeight * MASK_SCALE));
      const cell = Math.round(Math.min(64, Math.max(36, window.innerWidth * 0.028)));
      pattern.setAttribute("width", String(cell));
      pattern.setAttribute("height", String(cell));
      path.setAttribute("d", `M ${cell} 0 L 0 0 0 ${cell}`);
      last = { x: NaN, y: NaN };
    };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const tick = () => {
      smooth.x += (mouse.x - smooth.x) * 0.1;
      smooth.y += (mouse.y - smooth.y) * 0.1;

      // Only redraw the mask while the spotlight is still moving.
      if (Math.abs(smooth.x - last.x) > 0.1 || Math.abs(smooth.y - last.y) > 0.1 || Number.isNaN(last.x)) {
        last = { ...smooth };
        const radius = Math.round(Math.min(420, Math.max(160, window.innerWidth * 0.16))) * MASK_SCALE;
        const cx = smooth.x * MASK_SCALE;
        const cy = smooth.y * MASK_SCALE;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.4, "rgba(255,255,255,1)");
        g.addColorStop(0.6, "rgba(255,255,255,0.75)");
        g.addColorStop(0.75, "rgba(255,255,255,0.4)");
        g.addColorStop(0.88, "rgba(255,255,255,0.12)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        const url = `url(${canvas.toDataURL()})`;
        reveal.style.maskImage = url;
        reveal.style.webkitMaskImage = url;
      }

      // Grid drifts against the cursor.
      const r = root.getBoundingClientRect();
      const nx = (smooth.x - r.left) / r.width - 0.5;
      const ny = (smooth.y - r.top) / r.height - 0.5;
      grid.x += (nx * 16 - grid.x) * 0.06;
      grid.y += (ny * 16 - grid.y) * 0.06;
      pattern.setAttribute("x", grid.x.toFixed(2));
      pattern.setAttribute("y", grid.y.toFixed(2));

      frame = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  const layer = "absolute inset-0 bg-cover bg-center bg-no-repeat";
  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden lg:block">
      <div className={layer} style={{ backgroundImage: `url("${BG_IMAGE_1}")` }} />
      <div
        ref={revealRef}
        className={layer}
        style={{ backgroundImage: `url("${BG_IMAGE_2}")`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" }}
      />
      <svg className="absolute inset-0 size-full" style={{ opacity: 0.1 }}>
        <defs>
          <pattern ref={patternRef} id="landing-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path ref={pathRef} d="M 48 0 L 0 0 0 48" fill="none" stroke="#64748b" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#landing-grid)" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

const TITLES: Record<Panel, string> = {
  workflow: "Workflow",
  features: "Features",
  token: "Token Launch",
  pricing: "API & Credits",
  faq: "FAQ",
  start: "New Project",
};

function Drawer({ open, panel, onClose, children }: { open: boolean; panel: Panel; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/20 backdrop-blur-xs transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[panel]}
        className={`absolute inset-y-0 right-0 flex w-full flex-col border-l border-gray-200 bg-white transition-transform duration-300 ease-out sm:max-w-[var(--drawer-max)] ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ padding: "var(--drawer-pad)" }}
      >
        <div className="flex items-center justify-between border-b border-gray-200 pb-[var(--section-gap)]">
          <h2 className="font-orbitron uppercase" style={{ fontWeight: 700, letterSpacing: "0.12em", fontSize: "calc(var(--logo) * 0.7)" }}>
            {TITLES[panel]}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="transition-opacity hover:opacity-50">
            <X strokeWidth={1.5} style={{ width: "var(--icon)", height: "var(--icon)" }} />
          </button>
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1 py-[var(--section-gap)]">{children}</div>
        <div className="border-t border-gray-200 pt-[var(--section-gap)] text-center uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
          Aestrodom © {new Date().getFullYear()} — Build anything with AI
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className="mt-1 block transition-colors hover:text-black">
            @{X_HANDLE} on X
          </a>
        </div>
      </aside>
    </div>
  );
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-1 uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.2em" }}>
      {children}
    </div>
  );
}

/** A drawer row: micro label, title, body. */
function Row({ label, title, body, aside }: { label?: string; title: string; body?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-gray-200 py-4 last:border-b-0">
      <div className="min-w-0">
        {label && (
          <div className="uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
            {label}
          </div>
        )}
        <div className="mt-1 font-semibold uppercase" style={{ fontSize: "var(--body)", letterSpacing: "0.12em" }}>
          {title}
        </div>
        {body && <p className="mt-1.5 leading-relaxed text-gray-600" style={{ fontSize: "var(--body)" }}>{body}</p>}
      </div>
      {aside}
    </li>
  );
}

function WorkflowPanel({ domain }: { domain: string }) {
  const steps = [
    ["Say what you want", "One sentence is enough to start. Add detail whenever you like."],
    ["Relevant files only", "Claude pulls in the files your request touches and nothing else."],
    ["Precise edits", "Changes land where they belong. The rest of your app stays put."],
    ["Verified build", "Type-checked and bundled in an isolated sandbox, repaired if it fails."],
    ["Published", `Your app gets its own address at {name}.${domain} with HTTPS, ready to share.`],
    ["Token, if you want", "Launch a project token on Pons V2, signed by your wallet."],
  ];
  return (
    <>
      <Subtitle>Six steps · you only do the first</Subtitle>
      <ol>
        {steps.map(([title, body], i) => (
          <Row key={title} label={`Step ${String(i + 1).padStart(2, "0")}`} title={title!} body={body} />
        ))}
      </ol>
    </>
  );
}

function FeaturesPanel({ domain }: { domain: string }) {
  const features = [
    ["Talk, don't type code", "Ask for changes in plain words. Claude edits only what the request needs and leaves your design alone."],
    ["Watch it update", "A live preview refreshes after every verified build."],
    ["Ship in one click", "Redeploys swap atomically. A failed build never takes the live version down."],
    ["Your own address", `Every project lives at {name}.${domain} with a certificate issued on demand.`],
    ["Isolated by default", "Each project builds and runs in its own container with CPU and memory limits."],
  ];
  const safety = [
    ["Sealed builds", "No root, no host files. Each project gets its own container."],
    ["Secrets stay server-side", "Platform keys never reach generated apps or the browser."],
    ["You sign everything", "Your wallet, your signature. Nothing is signed for you."],
    ["Checked on-chain", "Launch results are read from the real receipt and verified."],
  ];
  return (
    <>
      <Subtitle>Built for ideas, not toolchains</Subtitle>
      <ul>
        {features.map(([title, body]) => (
          <Row key={title} title={title!} body={body} />
        ))}
      </ul>
      <div className="mt-6">
        <Subtitle>Safety</Subtitle>
      </div>
      <ul>
        {safety.map(([title, body]) => (
          <Row key={title} title={title!} body={body} />
        ))}
      </ul>
    </>
  );
}

function TokenPanel({ token }: { token: TokenTerms | null }) {
  const terms: [string, string][] = token
    ? [
        ["Launch fee", token.launchFee],
        ["Creator tax", "1% – 4%"],
        ["Curve fee", token.curveFee],
        ["Supply", token.supply],
        ["Graduation", token.graduation],
        ["Chain id", String(token.chainId)],
      ]
    : [];
  const calls = [
    ["canLaunch(wallet)", "Eligibility is checked before the form appears."],
    ["previewLaunchEconomics(id, ETH)", token?.economics ? `Pinned in your params: ${token.economics}` : "Economics are pinned into your params."],
    ["launchToken(params) + fee", "Simulated first, then signed in your wallet."],
    ["TokenLaunched(token, curve)", "Read from the receipt and verified server-side."],
  ];
  return (
    <>
      <Subtitle>${TOKEN_SYMBOL}</Subtitle>
      <Subtitle>Pons V2 · Robinhood Chain</Subtitle>
      <p className="leading-relaxed text-gray-600" style={{ fontSize: "var(--body)" }}>
        Give your app a token in one signature. Terms are read from the factory again in your browser right before you sign.
      </p>
      <div className="mt-5 flex items-center gap-2 uppercase" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
        <span className={`size-1.5 rounded-full ${token ? "bg-black" : "bg-gray-300"}`} />
        {token ? "Live from chain" : "Chain unreachable right now"}
      </div>
      {token && (
        <>
          <dl className="mt-3 grid grid-cols-2 border-l border-t border-gray-200">
            {terms.map(([k, v]) => (
              <div key={k} className="border-b border-r border-gray-200 px-3 py-2.5">
                <dt className="uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
                  {k}
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums" style={{ fontSize: "var(--body)" }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex justify-between gap-3 text-gray-500" style={{ fontSize: "var(--micro)" }}>
            <a href={token.factoryUrl} target="_blank" rel="noopener noreferrer" className="uppercase tracking-[0.18em] hover:text-black">
              Factory {token.factory} ↗
            </a>
            <span className="uppercase tracking-[0.18em]">Config {token.config}</span>
          </div>
        </>
      )}
      <div className="mt-6">
        <Subtitle>Call sequence</Subtitle>
      </div>
      <ol>
        {calls.map(([code, note], i) => (
          <Row key={code} label={String(i + 1).padStart(2, "0")} title={code!} body={note} />
        ))}
      </ol>
      <a
        href="https://docs.ponsfamily.com/docs/v2"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 uppercase text-gray-500 hover:text-black"
        style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}
      >
        Pons V2 docs <ArrowUpRight className="size-3" />
      </a>
    </>
  );
}

function PricingPanel({ pricing, signedIn }: { pricing: Pricing; signedIn: boolean }) {
  const target = "/dashboard/billing";
  return (
    <>
      <Subtitle>Start free</Subtitle>
      <ul>
        <Row
          label="Free"
          title="Every account"
          body={`${pricing.freeRunsPerDay} AI runs a day in the builder, up to ${pricing.freeProjects} apps, hosting on your own subdomain with HTTPS.`}
          aside={<span className="font-orbitron font-bold" style={{ fontSize: "var(--body)" }}>$0</span>}
        />
      </ul>
      <div className="mt-6">
        <Subtitle>Credits · paid in $AESTRODOM</Subtitle>
      </div>
      <p className="leading-relaxed text-gray-600" style={{ fontSize: "var(--body)" }}>
        Keep building past the free runs, and use the Aestrodom API from your own tools. Each AI run is charged at Claude&apos;s own token price plus {pricing.marginPercent}%, nothing hidden.
      </p>
      {pricing.creditsPerUsd > 0 ? (
        <ul className="mt-2">
          {pricing.options.map((usd) => (
            <Row
              key={usd}
              title={`$${usd} top-up`}
              aside={
                <span className="whitespace-nowrap font-semibold tabular-nums" style={{ fontSize: "var(--body)" }}>
                  {(usd * pricing.creditsPerUsd).toLocaleString("en-US")} credits
                </span>
              }
            />
          ))}
          <li className="pt-3 text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.12em" }}>
            Any amount works. You pay the dollar value in $AESTRODOM at the live on-chain price
            {pricing.tokenUsd ? ` (now 1 $AESTRODOM ≈ $${pricing.tokenUsd})` : ""}.
          </li>
        </ul>
      ) : (
        <p className="mt-3 uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
          Top-ups open soon
        </p>
      )}
      <div className="mt-6">
        <Subtitle>API access</Subtitle>
      </div>
      <ul>
        <Row title="Personal API keys" body="Create apps, run Claude and deploy from scripts, bots and other tools with an aestro_sk_ key. API requests always spend credits." />
      </ul>
      <Link
        href={signedIn ? target : `/login?callbackUrl=${encodeURIComponent(target)}`}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-black bg-black px-4 py-2.5 font-semibold uppercase text-white transition-colors hover:bg-white hover:text-black"
        style={{ fontSize: "var(--body)", letterSpacing: "0.18em" }}
      >
        Get credits <ArrowUpRight className="size-[1.1em]" strokeWidth={1.5} />
      </Link>
    </>
  );
}

function FaqPanel({ domain }: { domain: string }) {
  const faq = [
    ["Do I need coding experience?", "Not at all. Describe what you want and Claude makes the change. You can peek at the code in a read-only view if you're curious."],
    ["What kind of apps can I make?", "Single-page apps built with React, TypeScript and Tailwind: landing pages, portfolios, dashboards, small games and interactive tools."],
    ["Where is my app hosted?", `Each deployment runs in its own container and is served at {your-project}.${domain} with automatic HTTPS.`],
    ["Who controls the token launch?", "You do. Aestrodom prepares the transaction from the current Pons V2 configuration, and your own wallet signs it. We never touch keys or seed phrases."],
    ["Will a token change my website?", "No. They're linked but independent. Editing your site later never touches the token's on-chain data."],
  ];
  return (
    <>
      <Subtitle>Good questions</Subtitle>
      <ul>
        {faq.map(([q, a]) => (
          <Row key={q} title={q!} body={a} />
        ))}
      </ul>
    </>
  );
}

/** Describe-your-app field: carries the prompt into the new-project page (via login if needed). */
function StartPanel({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go() {
    const prompt = value.trim().slice(0, 2000);
    const target = prompt ? `/dashboard/new?prompt=${encodeURIComponent(prompt)}` : "/dashboard/new";
    router.push(signedIn ? target : `/login?callbackUrl=${encodeURIComponent(target)}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <Subtitle>Describe the app you want</Subtitle>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={2000}
        rows={5}
        autoFocus
        placeholder="A booking page for my pottery studio…"
        aria-label="Describe the app you want to build"
        className="w-full resize-none rounded-md border border-gray-300 bg-white p-3 leading-relaxed outline-none transition-colors placeholder:text-gray-400 focus:border-black"
        style={{ fontSize: "var(--body)" }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setValue(s)}
            className="rounded-md border border-gray-300 px-2.5 py-1 uppercase text-gray-600 transition-colors hover:border-black hover:text-black"
            style={{ fontSize: "var(--micro)", letterSpacing: "0.12em" }}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="submit"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-black py-3.5 font-semibold uppercase text-white transition-opacity hover:opacity-85"
        style={{ fontSize: "var(--body)", letterSpacing: "0.18em" }}
      >
        {signedIn ? "Generate" : "Sign in & generate"} <ChevronRight className="size-4" />
      </button>
      <div className="mt-6 space-y-2 uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
        <Link href="/dashboard/templates" className="flex items-center gap-1 hover:text-black">
          Browse templates <ArrowUpRight className="size-3" />
        </Link>
        <Link href="/battleground" className="flex items-center gap-1 hover:text-black">
          Every live app on the Battleground <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Ornaments                                                           */
/* ------------------------------------------------------------------ */

function Checker() {
  const squares = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      // Alternate rows shift by half a square pair, which makes the checkerboard.
      const x = col * 9 + (row % 2 ? 4.5 : 0) + 0.35;
      squares.push(<rect key={`${row}-${col}`} x={x} y={row * 4.5 + 0.35} width="3.8" height="3.8" fill="currentColor" />);
    }
  }
  return (
    <svg aria-hidden viewBox="0 0 36 18" className="shrink-0 translate-y-[2px]" style={{ width: "var(--checker-w)", height: "var(--checker-h)" }}>
      {squares}
    </svg>
  );
}

function Globe() {
  return (
    <svg aria-hidden viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: "var(--globe)", height: "var(--globe)" }}>
      <circle cx="32" cy="32" r="28" />
      <line x1="4" y1="32" x2="60" y2="32" />
      <ellipse cx="32" cy="32" rx="28" ry="10" />
      <ellipse cx="32" cy="32" rx="28" ry="20" />
      <line x1="32" y1="4" x2="32" y2="60" />
      <ellipse cx="32" cy="32" rx="10" ry="28" />
      <ellipse cx="32" cy="32" rx="20" ry="28" />
    </svg>
  );
}
