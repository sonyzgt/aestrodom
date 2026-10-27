"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/** Ends both the Privy session and the Aestrodom session. */
function useLogout() {
  const { logout } = usePrivy();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async () => {
      setBusy(true);
      await logout().catch(() => undefined);
      await signOut({ redirectTo: "/" });
    },
  };
}

export function LogoutIconButton() {
  const { busy, run } = useLogout();
  return (
    <button onClick={run} disabled={busy} className="rounded-md p-1.5 text-subtle hover:bg-elevated hover:text-fg disabled:opacity-50" aria-label="Log out" title="Log out">
      <LogOut className="size-4" />
    </button>
  );
}

export function LogoutButton() {
  const { busy, run } = useLogout();
  return (
    <Button variant="outline" onClick={run} loading={busy}>
      Log out
    </Button>
  );
}
