import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

/** Edge middleware: redirects unauthenticated users away from protected pages. APIs check auth themselves. */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/project/:path*", "/admin/:path*"],
};
