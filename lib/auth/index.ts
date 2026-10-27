import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "./config";
import { rateLimit } from "@/lib/rate-limit";
import { log, errorMessage } from "@/lib/logger";
import { PrivyAuthError, privyAppId, privyJwks, verifyPrivyAccessToken, verifyPrivyIdentityToken, type PrivyProfile } from "./privy";

/**
 * Login is delegated to Privy (email, wallet, social — configured in the Privy dashboard).
 * The browser hands us Privy's access token; we verify it against Privy's public keys and then
 * issue our own Auth.js session, so every API route keeps using `requireUser()` unchanged.
 */
const inputSchema = z.object({
  accessToken: z.string().min(20).max(16_384),
  identityToken: z.string().max(16_384).optional(),
});

class PrivyLoginError extends CredentialsSignin {
  code = "privy";
}

function displayName(profile: PrivyProfile): string | null {
  if (profile.email) return profile.email.split("@")[0];
  if (profile.wallet) return `${profile.wallet.slice(0, 6)}…${profile.wallet.slice(-4)}`;
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "privy",
      name: "Privy",
      credentials: { accessToken: {}, identityToken: {} },
      async authorize(raw) {
        const parsed = inputSchema.safeParse({
          accessToken: raw?.accessToken,
          identityToken: raw?.identityToken || undefined,
        });
        if (!parsed.success) return null;

        const h = await headers();
        const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
        const limited = await rateLimit(`auth:privy:${ip}`, { limit: 30, windowSec: 15 * 60 });
        if (!limited.ok) throw new PrivyLoginError();

        try {
          const appId = privyAppId();
          const opts = { appId, keys: privyJwks(appId) };
          const { privyId } = await verifyPrivyAccessToken(parsed.data.accessToken, opts);
          let profile: PrivyProfile = { email: null, wallet: null };
          if (parsed.data.identityToken) {
            profile = await verifyPrivyIdentityToken(parsed.data.identityToken, privyId, opts).catch(() => profile);
          }

          let user = await prisma.user.findUnique({ where: { privyId } });
          if (user?.disabled) {
            log.warn("auth.privy.disabled", { userId: user.id });
            return null;
          }
          // Only store an email that Privy verified and that no other account already uses.
          const emailFree =
            profile.email && !(await prisma.user.findFirst({ where: { email: profile.email, NOT: { privyId } }, select: { id: true } }));
          if (!user) {
            user = await prisma.user.create({
              data: {
                privyId,
                email: emailFree ? profile.email : null,
                walletAddress: profile.wallet,
                name: displayName(profile),
              },
            });
            log.info("auth.privy.signup", { userId: user.id });
          } else if ((emailFree && !user.email) || (profile.wallet && !user.walletAddress)) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                ...(emailFree && !user.email ? { email: profile.email } : {}),
                ...(profile.wallet && !user.walletAddress ? { walletAddress: profile.wallet } : {}),
                ...(!user.name ? { name: displayName(profile) } : {}),
              },
            });
          }
          log.info("auth.privy.login", { userId: user.id });
          return { id: user.id, email: user.email, name: user.name, role: user.role };
        } catch (err) {
          if (err instanceof PrivyAuthError) {
            log.warn("auth.privy.rejected", { reason: err.message });
            return null;
          }
          log.error("auth.privy.error", { error: errorMessage(err) });
          throw new PrivyLoginError();
        }
      },
    }),
  ],
});
