import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Server-only packages with native or dynamic requires.
  serverExternalPackages: ["dockerode", "ioredis", "tar-stream"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Nothing may frame the app.
      { source: "/:path*", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
  webpack(config) {
    // Optional peer deps pulled in by WalletConnect / MetaMask SDK that are not used in the browser.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Unused x402 payment modules referenced by the Base Account connector's dependency tree.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core/client": false,
      "@x402/evm": false,
      "@x402/evm/exact/client": false,
      "@x402/evm/upto/client": false,
      "@x402/svm/exact/client": false,
      // React Native storage referenced by the MetaMask SDK browser bundle.
      "@react-native-async-storage/async-storage": false,
      // Optional Privy integration (Farcaster mini-apps on Solana) that PRISMATIC does not use.
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};

export default nextConfig;
