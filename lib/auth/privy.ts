import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/**
 * Server-side verification of Privy tokens (https://docs.privy.io).
 *
 * Privy access tokens and identity tokens are ES256 JWTs with `iss = "privy.io"` and
 * `aud = <Privy app id>`. They are verified against the app's public JWKS, so no Privy secret
 * is needed on the server and nothing the browser claims about the user is trusted.
 */
export class PrivyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivyAuthError";
  }
}

export function privyAppId(): string {
  const id = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID;
  if (!id) throw new PrivyAuthError("NEXT_PUBLIC_PRIVY_APP_ID is not configured.");
  return id;
}

const jwksCache = new Map<string, JWTVerifyGetKey>();
export function privyJwks(appId: string): JWTVerifyGetKey {
  let set = jwksCache.get(appId);
  if (!set) {
    set = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
    jwksCache.set(appId, set);
  }
  return set;
}

export interface VerifyOptions {
  appId: string;
  keys: JWTVerifyGetKey;
}

async function verify(token: string, opts: VerifyOptions) {
  if (typeof token !== "string" || token.length < 20 || token.length > 16_384) throw new PrivyAuthError("Malformed token");
  try {
    const { payload } = await jwtVerify(token, opts.keys, {
      issuer: "privy.io",
      audience: opts.appId,
      algorithms: ["ES256"],
      clockTolerance: 30,
    });
    if (typeof payload.sub !== "string" || !payload.sub.startsWith("did:privy:")) throw new PrivyAuthError("Invalid subject");
    return payload;
  } catch (err) {
    if (err instanceof PrivyAuthError) throw err;
    throw new PrivyAuthError("Invalid or expired Privy token");
  }
}

/** Verifies a Privy access token and returns the user's Privy DID. */
export async function verifyPrivyAccessToken(token: string, opts: VerifyOptions): Promise<{ privyId: string; sessionId: string | null }> {
  const payload = await verify(token, opts);
  return { privyId: payload.sub as string, sessionId: typeof payload.sid === "string" ? payload.sid : null };
}

export interface PrivyProfile {
  email: string | null;
  wallet: string | null;
}

interface LinkedAccount {
  type?: string;
  address?: string;
  email?: string;
  chain_type?: string;
}

/**
 * Verifies an optional Privy identity token (enable "Return user data in an identity token" in the
 * Privy dashboard) and extracts a verified email / wallet for display. Must belong to `privyId`.
 */
export async function verifyPrivyIdentityToken(token: string, privyId: string, opts: VerifyOptions): Promise<PrivyProfile> {
  const payload = await verify(token, opts);
  if (payload.sub !== privyId) throw new PrivyAuthError("Identity token does not match the session");
  let accounts: LinkedAccount[] = [];
  try {
    const raw = payload.linked_accounts;
    accounts = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? (raw as LinkedAccount[]) : [];
  } catch {
    accounts = [];
  }
  return profileFromLinkedAccounts(accounts);
}

export function profileFromLinkedAccounts(accounts: LinkedAccount[]): PrivyProfile {
  const emailAcct = accounts.find((a) => a.type === "email" && a.address);
  const oauthEmail = accounts.find((a) => /_oauth$/.test(a.type ?? "") && a.email);
  const wallet = accounts.find((a) => a.type === "wallet" && a.address && (a.chain_type ?? "ethereum") === "ethereum");
  const email = (emailAcct?.address ?? oauthEmail?.email ?? null)?.toLowerCase() ?? null;
  return {
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null,
    wallet: wallet?.address && /^0x[0-9a-fA-F]{40}$/.test(wallet.address) ? wallet.address : null,
  };
}
