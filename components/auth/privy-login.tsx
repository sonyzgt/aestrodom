"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getIdentityToken, usePrivy } from "@privy-io/react-auth";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * "Continue with Privy" → Privy modal → exchange Privy's access token for a Aestrodom session.
 * The server verifies the token against Privy's public keys before creating the session.
 */
export function PrivyLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const attempted = useRef(false);

  const exchange = useCallback(async () => {
    setExchanging(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Privy session expired. Please sign in again.");
      const identityToken = (await getIdentityToken().catch(() => null)) ?? undefined;
      const res = await signIn("privy", { accessToken, identityToken, redirect: false });
      if (!res || res.error) throw new Error("We couldn't verify your Privy login. Please try again.");
      const next = params.get("callbackUrl");
      const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.replace(safe);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setExchanging(false);
      await logout().catch(() => undefined);
    }
  }, [getAccessToken, logout, params, router]);

  // Once Privy reports an authenticated user, create our session (once per page load).
  useEffect(() => {
    if (ready && authenticated && !attempted.current) {
      attempted.current = true;
      exchange();
    }
  }, [ready, authenticated, exchange]);

  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return <p className="text-sm text-danger">Login is not configured (NEXT_PUBLIC_PRIVY_APP_ID is missing).</p>;
  }

  return (
    <div className="space-y-4">
      <Button
        className="w-full"
        size="lg"
        loading={!ready || exchanging}
        onClick={() => {
          attempted.current = false;
          login();
        }}
      >
        {exchanging ? "Signing you in…" : "Continue with Privy"}
      </Button>
      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-subtle">Sign in with email, wallet or social account. New here? An account is created automatically.</p>
    </div>
  );
}
