import { Suspense } from "react";
import { PrivyLogin } from "@/components/auth/privy-login";
import { HopText } from "@/components/motion/hop-text";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="panel rounded-lg p-7">
      <h1 className="text-[26px] leading-tight">
        <HopText text="Welcome to *Aestrodom.*" trigger="load" />
        <br />
        <span className="text-muted">Sign in to start building.</span>
      </h1>
      <div className="mt-7" />
      <Suspense>
        <PrivyLogin />
      </Suspense>
    </div>
  );
}
