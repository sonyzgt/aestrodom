import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** The current, non-disabled user from the database (a valid cookie alone is not enough), or null. */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, walletAddress: true, role: true, plan: true, credits: true, disabled: true, createdAt: true },
  });
  return user && !user.disabled ? user : null;
}

/** For server components: the current user, or redirect to /login. */
export async function currentUserOrRedirect() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
