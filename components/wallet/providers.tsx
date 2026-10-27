"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { robinhood } from "@/lib/chains/robinhood";

function makeConfig() {
  const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://aestrodom.org";
  return createConfig({
    chains: [robinhood],
    ssr: true,
    connectors: [
      injected({ shimDisconnect: true }),
      coinbaseWallet({ appName: "Aestrodom" }),
      ...(wcProjectId
        ? [walletConnect({ projectId: wcProjectId, metadata: { name: "Aestrodom", description: "Build anything with AI", url: origin, icons: [`${origin}/icon.png`] } })]
        : []),
    ],
    transports: { [robinhood.id]: http(robinhood.rpcUrls.default.http[0]) },
  });
}

/** Wallet context (wagmi + viem). Users always connect and sign with their own wallet. */
export function WalletProviders({ children }: { children: React.ReactNode }) {
  const [config] = useState(makeConfig);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
