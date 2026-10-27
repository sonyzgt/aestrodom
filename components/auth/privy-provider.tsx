"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { useTheme } from "@/components/theme-toggle";

/**
 * Privy login context. The App ID is public by design. Login methods (email, wallet, Google, …)
 * are configured in the Privy dashboard, so they can change without a deploy.
 */
export function AuthProviders({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const theme = useTheme();
  if (!appId) return <>{children}</>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: theme === "light" ? "light" : "dark",
          accentColor: theme === "light" ? "#000000" : "#ffffff",
          logo: "/icon.png",
          landingHeader: "Sign in to Aestrodom",
          showWalletLoginFirst: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
