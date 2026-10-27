import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Orbitron, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProviders } from "@/components/auth/privy-provider";
import { THEME_KEY } from "@/lib/theme";
import "./globals.css";

const SITE_URL = process.env.NEXTAUTH_URL || "https://aestrodom.org";
const SITE_TITLE = "Aestrodom — Build anything with AI";
const SITE_DESCRIPTION = "Describe it. Claude builds it, Aestrodom deploys it live, and you launch its token on Pons V2 · Robinhood Chain in one click.";
// Link preview card for X, Telegram, Discord, etc. (public/og.png, 1200×630).
const OG_IMAGE = { url: "/og.png?v=2", width: 1200, height: 630, alt: "Aestrodom — Build anything with AI. Prompt → code → deploy → $token." };

// Orbitron for headlines, Plus Jakarta Sans for everything else (see --font-display / --font-sans).
const orbitron = Orbitron({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-orbitron" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Aestrodom" },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: "Aestrodom", url: "/", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", site: "@aestrodom_ai", creator: "@aestrodom_ai", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }], apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Applies the saved theme before first paint (no flash). "light" (pure white) is the default.
const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${orbitron.variable} ${jakarta.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <AuthProviders>{children}</AuthProviders>
        <Toaster position="bottom-right" toastOptions={{ className: "!bg-elevated !border-border-strong !text-fg !rounded-md" }} />
      </body>
    </html>
  );
}
