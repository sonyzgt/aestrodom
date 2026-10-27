import { describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { PrivyAuthError, profileFromLinkedAccounts, verifyPrivyAccessToken, verifyPrivyIdentityToken } from "@/lib/auth/privy";

const APP_ID = "test-app-id";
const DID = "did:privy:abc123";

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const attacker = await generateKeyPair("ES256");
  const sign = (claims: Record<string, unknown>, opts: { key?: CryptoKey; iss?: string; aud?: string; exp?: string; sub?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setIssuer(opts.iss ?? "privy.io")
      .setAudience(opts.aud ?? APP_ID)
      .setSubject(opts.sub ?? DID)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "1h")
      .sign(opts.key ?? privateKey);
  return { keys, sign, attackerKey: attacker.privateKey };
}

describe("Privy access token verification", () => {
  it("accepts a valid token and returns the Privy DID", async () => {
    const { keys, sign } = await setup();
    const res = await verifyPrivyAccessToken(await sign({ sid: "s1" }), { appId: APP_ID, keys });
    expect(res).toEqual({ privyId: DID, sessionId: "s1" });
  });

  it("rejects forged, expired, wrong-app and wrong-issuer tokens", async () => {
    const { keys, sign, attackerKey } = await setup();
    const opts = { appId: APP_ID, keys };
    await expect(verifyPrivyAccessToken(await sign({}, { key: attackerKey }), opts)).rejects.toThrow(PrivyAuthError);
    await expect(verifyPrivyAccessToken(await sign({}, { exp: "-10m" }), opts)).rejects.toThrow(PrivyAuthError);
    await expect(verifyPrivyAccessToken(await sign({}, { aud: "other-app" }), opts)).rejects.toThrow(PrivyAuthError);
    await expect(verifyPrivyAccessToken(await sign({}, { iss: "evil.io" }), opts)).rejects.toThrow(PrivyAuthError);
    await expect(verifyPrivyAccessToken(await sign({}, { sub: "user-123" }), opts)).rejects.toThrow(/subject/);
    await expect(verifyPrivyAccessToken("not.a.jwt.at.all.really", opts)).rejects.toThrow(PrivyAuthError);
  });

  it("rejects unsigned (alg none) tokens", async () => {
    const { keys } = await setup();
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none" })}.${b64({ iss: "privy.io", aud: APP_ID, sub: DID, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    await expect(verifyPrivyAccessToken(none, { appId: APP_ID, keys })).rejects.toThrow(PrivyAuthError);
  });
});

describe("Privy identity token", () => {
  it("extracts verified email and wallet", async () => {
    const { keys, sign } = await setup();
    const linked = JSON.stringify([
      { type: "email", address: "Alice@Example.com" },
      { type: "wallet", address: "0x1234567890abcdef1234567890abcdef12345678", chain_type: "ethereum" },
    ]);
    const profile = await verifyPrivyIdentityToken(await sign({ linked_accounts: linked }), DID, { appId: APP_ID, keys });
    expect(profile).toEqual({ email: "alice@example.com", wallet: "0x1234567890abcdef1234567890abcdef12345678" });
  });

  it("must belong to the same user as the access token", async () => {
    const { keys, sign } = await setup();
    const other = await sign({ linked_accounts: "[]" }, { sub: "did:privy:someone-else" });
    await expect(verifyPrivyIdentityToken(other, DID, { appId: APP_ID, keys })).rejects.toThrow(/does not match/);
  });

  it("uses OAuth email when there is no email account and ignores junk", () => {
    expect(profileFromLinkedAccounts([{ type: "google_oauth", email: "bob@gmail.com" }])).toEqual({ email: "bob@gmail.com", wallet: null });
    expect(profileFromLinkedAccounts([{ type: "email", address: "not-an-email" }, { type: "wallet", address: "abc" }])).toEqual({ email: null, wallet: null });
  });
});
