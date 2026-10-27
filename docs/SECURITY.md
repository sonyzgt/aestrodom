# Aestrodom security model

## Trust boundaries

| Untrusted | Treated as |
|---|---|
| User prompts, chat history, project files | Data. Wrapped in tagged blocks; the system prompt tells Claude not to follow instructions found inside them. |
| Claude's output | Proposals. Every tool call is schema-validated (Zod, strict objects) and every path is normalized and confined before anything is written. Claude cannot run commands; the only "execution" is the fixed build script inside the sandbox. |
| Generated application code | Hostile. Never executed on the host — only inside a sandbox container. |
| Request bodies (`projectId`, `userId`, `role`, wallet address, token address, tx hash) | Never trusted. Identity comes from the session and is re-read from the database on every request; launch data is re-derived from the chain. |

## Authentication & authorization

- Login is delegated to **Privy**. The browser sends Privy's access token (and optionally the identity
  token); the server verifies them as ES256 JWTs against the app's public JWKS
  (`https://auth.privy.io/api/v1/apps/{appId}/jwks.json`) with `iss = privy.io` and `aud = appId`,
  rejects forged/expired/`alg:none` tokens, and only then issues an Auth.js JWT session (14 days).
  Email/wallet are stored only when they come from a verified identity token. Login is rate-limited
  per IP. No passwords are stored.
- `requireUser()` re-loads the user from the database on every API call (disabled users are cut off
  immediately; role changes apply immediately).
- `requireProject(id, user.id)` queries `{ id, userId }` together. Another user's project returns
  **404**, not 403, so ids cannot be probed. Every project route uses it — files, AI, deploy, stop,
  preview, logs, messages, token prepare/confirm, settings, delete.
- Admin pages re-check `role === "ADMIN"` from the database and 404 otherwise.
- State-changing API requests with a foreign `Origin` header are rejected (CSRF defence in depth on
  top of `SameSite=Lax` cookies; Auth.js endpoints carry their own CSRF tokens).

## Filesystem

`lib/projects/paths.ts` + `lib/projects/filesystem.ts`:

- Only relative POSIX paths with a conservative character set; `..`, `.`, empty segments, absolute
  paths, drive letters, `~`, backslashes and control characters are rejected (never "fixed up").
- Reserved prefixes (`node_modules/`, `dist/`, `.git/`, `.prismatic/`, `.env*`) are rejected.
- Toolchain files (`package.json`, `vite.config.ts`, `tsconfig.json`) are read-only; writable
  extensions are an allow-list of text types.
- Resolved paths are checked lexically **and** via `realpath` of the nearest existing ancestor, so a
  planted symlink cannot escape the project root. Directory walks never follow symlinks.
- Per-file (512 KB), per-project file count (400) and per-plan storage limits.

## Sandbox (Docker)

`lib/runtime/docker.ts` creates every project container with:

- the fixed `prismatic-runtime` image, user `1000:1000` (non-root)
- `CapDrop: ALL`, `no-new-privileges`, `Privileged: false`, private IPC
- memory (+swap) limit, CPU quota, PID limit, build timeout (`timeout -s KILL`)
- `/tmp` as `noexec,nosuid,nodev` tmpfs
- **no bind mounts and no volumes** — source is copied in with the archive API; the host filesystem
  and the Docker socket are never visible to project code
- **empty environment** — no Aestrodom secret (`ANTHROPIC_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`,
  RPC credentials …) can reach generated code
- production: attached only to the `internal: true` project network (no internet egress), reachable
  only by Caddy
- the app talks to Docker through `tecnativa/docker-socket-proxy` with volumes/system/swarm/build
  endpoints disabled

Builds use a fixed Vite config and a pinned package set baked into the image; a project cannot add
plugins or install packages. Output is staged and swapped in only on success.

## Previews

Previews are served from a different site than the app (`*.preview.prismatic.com` in production,
`127.0.0.1:{port}` vs `localhost` locally) and embedded in an iframe with
`sandbox="allow-scripts allow-forms allow-popups allow-modals"` — **without** `allow-same-origin`, so
preview code runs in an opaque origin with no access to Aestrodom cookies or storage.

## Secrets

- `ANTHROPIC_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `CADDY_ASK_SECRET`, `ROBINHOOD_RPC_URL` are
  server-only (`import "server-only"` guards the modules that read them). The production build was
  scanned: no secret names or server SDKs appear in `.next/static`.
- Only `NEXT_PUBLIC_ROBINHOOD_RPC_URL` and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` reach the browser;
  both are public by design. Never put a credentialed RPC URL in a `NEXT_PUBLIC_` variable.
- The structured logger redacts secret-looking keys and values (API keys, connection strings,
  passwords, mnemonics, auth headers). Errors shown to users are generic; stack traces stay in logs.

## Wallet & token launch (non-custodial)

- Aestrodom never asks for, receives, stores or uses private keys, seed phrases or wallet passwords.
- `POST /token/prepare` returns public configuration only (addresses, chain id, on-chain fee/config,
  prefilled metadata). It never signs anything.
- The browser re-reads `canLaunch`, `launchFee`, `maxCreatorTaxBps`, the config and
  `previewLaunchEconomics` from the chain immediately before signing, pins the economics hash in
  `TokenParams.expectedEconomics`, uses a fresh CSPRNG salt, checks balance ≥ fee (+ buy) + gas, and
  **simulates** the exact call before the wallet prompt. `LaunchEconomicsMismatch` sends the user
  back to review the refreshed terms.
- Creator fees go to the address the user chose (default: their connected wallet). Aestrodom never
  inserts itself as a recipient or modifies parameters.
- `POST /token/confirm` accepts only a transaction hash. The server fetches the receipt itself,
  requires success, requires `to` ∈ {factory, LaunchAndBuy router}, parses `TokenLaunched` emitted by
  the factory, reads `getLaunchedToken` and `getTokenInfo`, and requires the token's on-chain website
  to equal this project's URL — so a user cannot attach someone else's launch to their project.
- Token phase is read from `getLaunchedToken().phase`, never inferred from price.

## Abuse & cost controls

- Rate limits (Redis in production, in-memory locally): AI, project creation, deploy/preview,
  token prepare/confirm, login, registration.
- Per-plan daily AI request and token budgets, max projects, max storage; prompt length cap; one
  agent run per project at a time; agent step cap; max 3 automatic build repairs.
- Caddy issues certificates only for hosts the app confirms are live.

## Tested

See `tests/` (unit + opt-in live chain simulation) and `scripts/e2e-api.mjs` (57 HTTP checks:
forged Privy tokens, session, cross-user read/write/delete/deploy/AI/token, traversal, CSRF, slug rules, gating).
