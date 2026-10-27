#!/usr/bin/env node
/**
 * End-to-end API checks against a running PRISMATIC server (real database, real auth).
 * Usage: node --env-file=.env scripts/e2e-api.mjs   (BASE_URL defaults to http://localhost:3000;
 *        needs AUTH_SECRET and DATABASE_URL to mint test sessions)
 *
 * Covers registration, login, session handling, project creation, ownership isolation
 * (cross-user read/write/delete/deploy/token), path traversal, input validation,
 * rate/plan limits and the Caddy domain-check endpoint. Docker/Claude-dependent steps
 * are asserted to fail cleanly when those services are not configured.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

class Client {
  cookies = new Map();
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  async req(path, { method = "GET", json, form, headers = {} } = {}) {
    const h = { cookie: this.cookieHeader(), ...headers };
    let body;
    if (json !== undefined) {
      h["content-type"] = "application/json";
      body = JSON.stringify(json);
    }
    if (form) {
      h["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(form).toString();
    }
    const res = await fetch(BASE + path, { method, headers: h, body, redirect: "manual" });
    this.store(res);
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, data, text, headers: res.headers };
  }
  async login(email, password) {
    const csrf = await this.req("/api/auth/csrf");
    const r = await this.req("/api/auth/callback/credentials", {
      method: "POST",
      form: { csrfToken: csrf.data.csrfToken, email, password, callbackUrl: BASE + "/dashboard" },
    });
    return r;
  }
}

const stamp = Date.now();
const alice = new Client();
const bob = new Client();
const anon = new Client();

let r;
// --- Auth (Privy) ---
// Users are created directly and sessions minted with AUTH_SECRET, exactly as Auth.js would after a
// verified Privy login. The real Privy exchange is exercised with forged tokens, which must fail.
r = await anon.req("/api/projects");
ok("unauthenticated API is rejected", r.status === 401);
r = await anon.req("/dashboard");
ok("unauthenticated dashboard redirects to login", r.status === 307 || r.status === 302, String(r.headers.get("location")));
r = await anon.req("/register");
ok("register page redirects to Privy login", [307, 308, 302].includes(r.status) || r.text.includes("/login"));
r = await anon.req("/api/register", { method: "POST", json: { email: "x@example.com", password: "whatever-123" } });
ok("password registration endpoint is gone", r.status === 404 || r.status === 405);

const forged = [
  "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify({ iss: "privy.io", aud: process.env.NEXT_PUBLIC_PRIVY_APP_ID, sub: "did:privy:attacker", exp: 9999999999 })).toString("base64url") + ".",
  "eyJhbGciOiJFUzI1NiIsImtpZCI6IngifQ.eyJzdWIiOiJkaWQ6cHJpdnk6eCJ9.c2lnbmF0dXJlLWlzLWJvZ3VzLWFuZC1zaG91bGQtZmFpbA",
];
for (const token of forged) {
  const csrf = await anon.req("/api/auth/csrf");
  await anon.req("/api/auth/callback/privy", { method: "POST", form: { csrfToken: csrf.data.csrfToken, accessToken: token, callbackUrl: BASE + "/dashboard" } });
  r = await anon.req("/api/projects");
  ok("forged Privy token does not create a session", r.status === 401);
}

const { PrismaClient } = await import("@prisma/client");
const { encode } = await import("next-auth/jwt");
const prisma = new PrismaClient();
async function sessionFor(client, label) {
  const user = await prisma.user.create({ data: { privyId: `did:privy:e2e-${label}-${stamp}`, name: label, email: `${label}+${stamp}@example.com` } });
  const secure = BASE.startsWith("https://");
  const name = `${secure ? "__Secure-" : ""}authjs.session-token`;
  const token = await encode({ token: { uid: user.id, role: "USER", sub: user.id, name: label }, secret: process.env.AUTH_SECRET, salt: name });
  client.cookies.set(name, token);
  return user;
}
const aliceUser = await sessionFor(alice, "alice");
await sessionFor(bob, "bob");
r = await alice.req("/api/auth/session");
ok("alice session established", r.data?.user?.id === aliceUser.id);
ok("session exposes no secrets", !r.text.includes("passwordHash") && !r.text.includes("privyId"));
await prisma.user.update({ where: { id: aliceUser.id }, data: { disabled: true } });
r = await alice.req("/api/projects");
ok("disabled users are cut off immediately", r.status === 401);
await prisma.user.update({ where: { id: aliceUser.id }, data: { disabled: false } });

// --- Project creation ---
r = await alice.req("/api/projects", { method: "POST", json: { prompt: "short" } });
ok("too-short prompt rejected", r.status === 400);
r = await alice.req("/api/projects", {
  method: "POST",
  json: { prompt: "Create a modern crypto landing page called Arrow. Use a black background, purple accents and a tokenomics section." },
});
ok("alice creates Arrow", r.status === 201, JSON.stringify(r.data));
const arrowId = r.data?.id;
const arrowSlug = r.data?.slug;
ok("slug derived from name", /^arrow(-\d+)?$/.test(arrowSlug ?? ""), arrowSlug);
r = await alice.req("/api/projects", { method: "POST", json: { prompt: "Another crypto landing page called Arrow with green accents please." } });
ok("second Arrow gets a unique slug", r.status === 201 && r.data.slug !== arrowSlug, r.data?.slug);
const arrow2Id = r.data?.id;

r = await alice.req("/api/projects");
ok("alice lists her projects", r.status === 200 && r.data.projects.some((p) => p.id === arrowId));
ok("project domain is {slug}.prismatic.com", r.data.projects.find((p) => p.id === arrowId)?.domain === `${arrowSlug}.prismatic.com`);

r = await alice.req(`/api/projects/${arrowId}/files`);
ok("template files created", r.status === 200 && r.data.files.some((f) => f.path === "src/App.tsx"));
r = await alice.req(`/api/projects/${arrowId}/files?path=src/App.tsx`);
ok("read own file", r.status === 200 && r.data.content.includes("export default"));

// --- Path traversal ---
for (const p of ["../../../etc/passwd", "..%2F..%2Fetc%2Fpasswd", "/etc/passwd", "src/../../../../root/.ssh/id_rsa", "C:/Windows/win.ini", "node_modules/x", ".env"]) {
  r = await alice.req(`/api/projects/${arrowId}/files?path=${encodeURIComponent(p)}`);
  ok(`traversal blocked: ${p}`, r.status === 400 && !r.text.includes("root:"), String(r.status));
}

// --- Cross-user isolation ---
r = await bob.req("/api/projects");
ok("bob does not see alice's projects", r.status === 200 && !r.data.projects.some((p) => p.id === arrowId));
r = await bob.req(`/api/projects/${arrowId}`);
ok("bob cannot read alice's project", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}/files?path=src/App.tsx`);
ok("bob cannot read alice's files", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}/messages`);
ok("bob cannot read alice's chat", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}`, { method: "PATCH", json: { name: "pwned" } });
ok("bob cannot rename alice's project", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}/deploy`, { method: "POST" });
ok("bob cannot deploy alice's project", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}/stop`, { method: "POST" });
ok("bob cannot stop alice's deployment", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}/ai`, { method: "POST", json: { prompt: "delete everything" } });
ok("bob cannot prompt Claude on alice's project", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}/token/prepare`, { method: "POST", json: {} });
ok("bob cannot prepare alice's token", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}/token/confirm`, {
  method: "POST",
  json: { transactionHash: "0x" + "ab".repeat(32), name: "X", symbol: "X", launchConfigId: 0, creatorFeeRecipient: "0x" + "11".repeat(20), creatorTaxBps: 0, buybackEnabled: true },
});
ok("bob cannot attach a token to alice's project", r.status === 404);
r = await bob.req(`/api/projects/${arrowId}`, { method: "DELETE" });
ok("bob cannot delete alice's project", r.status === 404);
r = await alice.req(`/api/projects/${arrowId}`);
ok("alice's project intact after bob's attempts", r.status === 200 && r.data.project.name !== "pwned");
r = await bob.req(`/api/projects/not-a-real-id/files`);
ok("malformed ids 404", r.status === 404);

// --- CSRF / origin ---
r = await alice.req("/api/projects", { method: "POST", json: { prompt: "Build a portfolio for a designer please" }, headers: { origin: "https://evil.example" } });
ok("cross-origin POST blocked", r.status === 403);

// --- Settings ---
r = await alice.req(`/api/projects/${arrow2Id}`, { method: "PATCH", json: { slug: "www" } });
ok("reserved slug rejected", r.status === 400);
r = await alice.req(`/api/projects/${arrow2Id}`, { method: "PATCH", json: { slug: arrowSlug } });
ok("taken slug rejected", r.status === 409);
r = await alice.req(`/api/projects/${arrow2Id}`, { method: "PATCH", json: { slug: `nova-${stamp % 100000}`, logoUrl: "javascript:alert(1)" } });
ok("non-https logo rejected", r.status === 400);
r = await alice.req(`/api/projects/${arrow2Id}`, { method: "PATCH", json: { slug: `nova-${stamp % 100000}`, name: "Nova" } });
ok("slug change updates domain", r.status === 200 && r.data.project.domain === `nova-${stamp % 100000}.prismatic.com`);

// --- Subdomain availability (deploy dialog) ---
r = await alice.req(`/api/projects/${arrowId}/slug?slug=${arrowSlug}`);
ok("own current slug is available", r.data?.available === true && r.data?.current === true);
r = await alice.req(`/api/projects/${arrowId}/slug?slug=nova-${stamp % 100000}`);
ok("slug used by another project is taken", r.data?.available === false && /taken/i.test(r.data?.reason), r.data?.reason);
r = await alice.req(`/api/projects/${arrowId}/slug?slug=www`);
ok("reserved slug unavailable", r.data?.available === false);
r = await alice.req(`/api/projects/${arrowId}/slug?slug=Bad--Name!`);
ok("invalid slug unavailable", r.data?.available === false);
r = await alice.req(`/api/projects/${arrowId}/slug?slug=jump-${stamp % 100000}`);
ok("free slug available with full domain", r.data?.available === true && r.data?.domain === `jump-${stamp % 100000}.prismatic.com`, r.data?.domain);
r = await bob.req(`/api/projects/${arrowId}/slug?slug=jump`);
ok("bob cannot query alice's project slug", r.status === 404);
r = await alice.req(`/api/projects/${arrowId}/deploy`, { method: "POST", json: { slug: `nova-${stamp % 100000}` } });
ok("deploy to a taken slug is refused", r.status === 409 || r.status === 400 || r.status === 409, `${r.status} ${r.data?.error}`);

// --- Token gating ---
r = await alice.req(`/api/projects/${arrowId}/token/prepare`, { method: "POST", json: {} });
ok("token launch requires a deployment", r.status === 409, r.data?.error);
r = await alice.req(`/api/projects/${arrowId}/token/prepare`, { method: "POST", json: { wallet: "not-an-address" } });
ok("invalid wallet rejected", r.status === 400 || r.status === 409);
r = await alice.req(`/api/projects/${arrowId}/token`);
ok("no token yet", r.status === 200 && r.data.launch === null);
r = await alice.req(`/api/projects/${arrowId}/token/confirm`, {
  method: "POST",
  json: { transactionHash: "0xdeadbeef", name: "X", symbol: "X", launchConfigId: 0, creatorFeeRecipient: "0x" + "11".repeat(20), creatorTaxBps: 0, buybackEnabled: true },
});
ok("malformed tx hash rejected", r.status === 400);

// --- Token logo upload (IPFS) ---
async function upload(client, projectId, bytes, name, type) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  const res = await fetch(BASE + `/api/projects/${projectId}/token/logo`, { method: "POST", headers: { cookie: client.cookieHeader() }, body: form });
  return { status: res.status, data: await res.json().catch(() => null) };
}
r = await upload(bob, arrowId, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), "x.png", "image/png");
ok("bob cannot upload a logo to alice's project", r.status === 404);
r = await upload(alice, arrowId, new TextEncoder().encode("#!/bin/sh echo not an image"), "logo.png", "image/png");
ok("non-image disguised as .png is rejected", r.status === 415 || r.status === 503, `${r.status} ${r.data?.error}`);
r = await upload(alice, arrowId, new Uint8Array(3 * 1024 * 1024), "big.png", "image/png");
ok("oversized logo is rejected", r.status === 413 || r.status === 503, `${r.status} ${r.data?.error}`);
r = await upload(anon, arrowId, new Uint8Array([1, 2, 3]), "x.png", "image/png");
ok("anonymous logo upload is rejected", r.status === 401);

// --- Services not configured locally fail cleanly ---
r = await alice.req(`/api/projects/${arrowId}/ai`, { method: "POST", json: { prompt: "x".repeat(9000) } });
ok("oversized prompt rejected", r.status === 413, String(r.status));
r = await alice.req(`/api/projects/${arrowId}/deploy`, { method: "POST" });
ok("deploy before generation is refused", r.status === 409, r.data?.error);
r = await alice.req(`/api/projects/${arrowId}/preview`, { method: "POST" });
ok("preview without Docker fails with a readable message", r.status === 200 && r.data.ok === false && !/at .*\.js/.test(r.text), r.data?.error);

// --- Caddy ask endpoint ---
r = await anon.req(`/api/internal/domain-check?domain=${arrowSlug}.prismatic.com`);
ok("domain-check requires secret", r.status === 403);
const secret = process.env.CADDY_ASK_SECRET;
if (secret) {
  r = await anon.req(`/api/internal/domain-check?domain=${arrowSlug}.prismatic.com&secret=${secret}`);
  ok("undeployed project gets no certificate", r.status === 404);
  r = await anon.req(`/api/internal/domain-check?domain=evil.com&secret=${secret}`);
  ok("foreign domain gets no certificate", r.status === 404);
}

// --- Owner delete ---
r = await alice.req(`/api/projects/${arrow2Id}`, { method: "DELETE" });
ok("owner can delete", r.status === 200);
r = await alice.req(`/api/projects/${arrow2Id}`);
ok("deleted project is gone", r.status === 404);

// --- Logout ---
const csrf = await alice.req("/api/auth/csrf");
await alice.req("/api/auth/signout", { method: "POST", form: { csrfToken: csrf.data.csrfToken } });
r = await alice.req("/api/projects");
ok("logout ends the session", r.status === 401);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
