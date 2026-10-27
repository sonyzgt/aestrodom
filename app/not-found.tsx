import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <div className="font-mono text-sm text-subtle">404</div>
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn&apos;t exist.</h1>
      <Button asChild variant="secondary"><Link href="/dashboard">Back to dashboard</Link></Button>
    </div>
  );
}
