import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration (no database or bcrypt imports) shared by the
 * middleware and the full server configuration in `lib/auth/index.ts`.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const protectedRoute =
        pathname.startsWith("/dashboard") || pathname.startsWith("/project") || pathname.startsWith("/admin");
      if (protectedRoute) return !!auth?.user;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as string) ?? "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
