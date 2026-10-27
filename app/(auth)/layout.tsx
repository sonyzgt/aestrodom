import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { Logo } from "@/components/brand";
import { DotField } from "@/components/motion/dot-field";
import { FloatingShapes } from "@/components/motion/shapes";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Check the database, not just the cookie: a stale session for a deleted user must not loop.
  if (await currentUser()) redirect("/dashboard");
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12">
      <DotField />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_50%_50%,var(--bg)_40%,transparent_85%)]" />
      <FloatingShapes
        trigger="load"
        shapes={[
          { kind: "circle", color: "red", pos: "left-[10%] top-[16%]", depth: 40 },
          { kind: "square", color: "yellow", pos: "right-[12%] top-[14%]", depth: -50 },
          { kind: "triangle", color: "sky", pos: "left-[14%] bottom-[18%]", depth: -35 },
          { kind: "ring", color: "green", pos: "right-[10%] bottom-[20%]", depth: 55 },
          { kind: "plus", color: "purple", pos: "left-[4%] top-[50%] max-md:hidden", depth: 30 },
          { kind: "zigzag", color: "orange", pos: "right-[4%] top-[48%] max-md:hidden", depth: -60 },
        ]}
      />
      <div className="relative w-full max-w-sm">
        <Logo className="mb-10 justify-center" />
        {children}
      </div>
    </div>
  );
}
