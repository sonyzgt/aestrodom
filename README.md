# Aestrodom

**Build anything with AI.** Describe your idea. Claude writes the code. Aestrodom deploys it.

Aestrodom is an AI application builder: a user describes an app, a Claude coding agent builds it,
the user watches a live preview, iterates in plain language, deploys it to `{slug}.prismatic.com`,
and can launch a token for the project through **Pons V2 on Robinhood Chain**.

```text
Describe → Claude edits files → sandboxed build → live preview → iterate
        → Deploy → arrow.prismatic.com → Launch Token → wallet signs → $ARROW
```

## Features

- **AI coding agent** — Claude (official Anthropic SDK, `claude-opus-5-5`) works through validated
  file tools (`list/read/write/edit/delete/rename`, `run_build`), makes minimal edits, verifies the
  build, and auto-repairs build failures up to 3 times.
- **Context manager** — only the files relevant to a request are sent (ranked by path/content
  keywords within a size budget), plus a rolling conversation summary. Static system prompt is
  prompt-cached.
- **Live preview** — every project builds and runs in its own Docker container; previews update
  atomically on each successful build.
- **One-click deploy** — separate production container per project, routed by Caddy at
  `{slug}.prismatic.com` with on-demand HTTPS.
- **Token launch** — wagmi/viem wallet flow against the Pons V2 factory: on-chain config, fee,
  creator-tax cap, eligibility and economics pinning; simulated before signing; `TokenLaunched`
  parsed from the real receipt and re-verified server-side. Optional Launch + Initial Buy with a
  slippage-bounded minimum computed from the curve math.
- **Token dashboard** — address, curve, phase (from `getLaunchedToken`), graduation progress,
  polled every 20s while visible.
- Login with **Privy** (email, wallet, Google, X… configured in the Privy dashboard), per-user isolation, plans & limits, rate limiting, admin overview,
  structured redacted logs, read-only Monaco code view, build/runtime/deploy console.

## Architecture

```text
Browser ──► Next.js app (App Router, API routes) ──► PostgreSQL (Prisma)
                 │        │                    └──► Redis (rate limits, prod)
                 │        └──► Claude API (server-only key)
                 └──► Docker API (socket proxy) ──► project containers (runtime image)
Caddy ──► app  |  {slug}.prismatic.com ──► site-{slug}  |  {slug}.preview.… ──► preview-{slug}
Browser wallet ──► Robinhood Chain (4663) ──► Pons V2 factory / LaunchAndBuy
```

| Path | Purpose |
|---|---|
| `lib/ai/claude.ts` | Anthropic client, streamed turns (adaptive thinking, effort, caching, refusal fallbacks) |
| `lib/ai/context.ts` | Relevant-file selection + context rendering |
| `lib/ai/tools.ts` | Tool schemas, Zod validation, structured file operations |
| `lib/ai/agent.ts` | Agent loop, build verification, auto-repair, usage accounting, persistence |
| `lib/projects/filesystem.ts` | Isolated per-project working copies (+ DB mirror) with traversal protection |
| `lib/runtime/{docker,build,preview}.ts` | Sandbox containers, builds, previews |
| `lib/deployment/` | `deployProject`, `stopProject`, `restartProject`, `getDeploymentStatus`, `getProjectDomain` |
| `lib/chains/robinhood.ts` | Robinhood Chain definition |
| `lib/pons/` | `abi`, `config`, `factory` (reads), `launch` (params, events, quotes, errors), `server` (verification), `types` |
| `runtime/` | Project runtime image: fixed toolchain, `build.mjs`, `serve.mjs` |
| `deploy/` | Production `docker-compose.yml`, `Caddyfile` |

Generated apps are **Vite + React 19 + TypeScript + Tailwind v4** with `framer-motion`,
`lucide-react`, `clsx`, `tailwind-merge`, `gsap`, `@gsap/react`, `radix-ui`, `class-variance-authority`, `tw-animate-css` available (static HTML/CSS/JS is a subset). The runtime
image pins these packages so builds need no network and projects can't install arbitrary code.

## Installation

Requirements: Node 22+, PostgreSQL 14+, Docker (for previews/deploys).

```bash
npm install
cp .env.example .env               # fill in, see below
npx prisma migrate deploy          # or: npm run db:migrate (dev)
npm run runtime:build              # docker build -t prismatic-runtime:latest runtime
npm run dev                        # http://localhost:3000
```

Sign in once with Privy, then promote yourself to admin: `node scripts/make-admin.mjs <email | did:privy:… | 0xWallet>`.

## Environment variables

See [`.env.example`](.env.example) for the full annotated list. Key ones:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Server-only. `ANTHROPIC_MODEL` (default `claude-opus-5-5`), `ANTHROPIC_EFFORT` (default `high`) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app id (public). Add your origins under *Allowed origins* in the Privy dashboard |
| `AUTH_SECRET`, `NEXTAUTH_URL` | Auth.js session cookies, issued after the Privy token is verified |
| `PRISMATIC_DOMAIN`, `PRISMATIC_PREVIEW_DOMAIN` | `prismatic.com`, `preview.prismatic.com` |
| `MAX_AI_REQUESTS_PER_DAY`, `MAX_PROJECTS_PER_USER`, `MAX_PROJECT_SIZE_MB`, `PRO_*`, `MAX_AI_TOKENS_PER_DAY` | Plan limits |
| `DEPLOYMENT_MODE` | `local` (loopback ports) or `production` (Caddy + internal network) |
| `DOCKER_HOST`, `RUNTIME_IMAGE`, `CONTAINER_*`, `BUILD_TIMEOUT_SECONDS` | Sandbox |
| `STORAGE_PATH` | Project working copies (default `./storage`) |
| `REDIS_URL` | Enables distributed rate limiting |
| `ROBINHOOD_RPC_URL` / `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Server / browser RPC |
| `PONS_V2_FACTORY_ADDRESS`, `PONS_V2_LAUNCH_AND_BUY_ADDRESS`, `PONS_V2_FEE_ESCROW_ADDRESS`, `PONS_V2_CHAIN_ID` | Pons V2 (centralized in `lib/pons/config.ts`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Enables WalletConnect |

## Database setup

Prisma models: `User`, `Project`, `ProjectFile`, `Conversation`, `Message`, `Deployment`, `Usage`,
`PonsLaunch`, `ProjectDomain`, `ProjectLog`. Migrations live in `prisma/migrations`.

```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # local Postgres + Redis
npx prisma migrate dev
```

## Claude setup

Set `ANTHROPIC_API_KEY`. The agent streams with adaptive thinking, `output_config.effort`,
prompt caching on the static system prompt and tool definitions, eager tool-input streaming with
schema validation, and server-side refusal fallbacks (`fallbacks: "default"`). Each request records
input/output/cache tokens in `Usage`.

## Docker setup

```bash
npm run runtime:build
```

Locally, Docker Desktop must be running. Containers are named `prismatic-preview-{id}` /
`prismatic-prod-{id}` and labelled `prismatic.*`.

## DNS & deployment setup

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: wildcard DNS (`*` and `*.preview`), Caddy with
on-demand TLS gated by `/api/internal/domain-check`, Docker socket proxy, compose stack.

## Robinhood Chain setup

Chain id **4663**, ETH gas, explorer https://robinhoodchain.blockscout.com. Defaults to the public
RPC `https://rpc.mainnet.chain.robinhood.com` (rate-limited) — use a dedicated provider for
production server reads.

## Pons V2 setup

Addresses (Robinhood Chain mainnet, from https://docs.ponsfamily.com/docs/v2 — verify before use):

| Contract | Address |
|---|---|
| Factory | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` |
| Launch and Buy | `0xe33E9E479dF8802cb0866d5d05258bEc4cF62948` |
| Fee Escrow | `0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e` |

The ABIs in `lib/pons/abi.ts` were transcribed from the official sources
(github.com/ponsdotdev/pons-labs) and checked against the deployed bytecode. Run the live,
read-only check (simulates launches via `eth_call`, broadcasts nothing):

```bash
RUN_LIVE_TESTS=1 npx vitest run tests/live
```

## Development

```bash
npm run dev          # Next.js dev server
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest unit tests
node --env-file=.env scripts/e2e-api.mjs   # HTTP E2E against a running server (mints test sessions with AUTH_SECRET)
```

## Production

`deploy/docker-compose.yml` runs Caddy, the app (standalone Next.js, migrations on start),
PostgreSQL, Redis and a restricted Docker socket proxy. See docs/DEPLOYMENT.md.

## Security

See **[docs/SECURITY.md](docs/SECURITY.md)** — ownership checks on every route, path confinement,
sandbox hardening (no mounts, no env, caps dropped, limits, no egress), preview origin isolation,
server-only secrets, non-custodial wallet flow with on-chain verification, rate and cost limits.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "The preview runtime is not available" | Start Docker; check `DOCKER_HOST`. |
| "Runtime image … is missing" | `npm run runtime:build` |
| "Claude is not configured on this server" | Set `ANTHROPIC_API_KEY` and restart. |
| Build keeps failing after 3 repairs | Open **Console** for the compiler output; ask Claude to simplify the change. |
| Certificates not issued for `{slug}.prismatic.com` | DNS wildcard must point at the server; `CADDY_ASK_SECRET` must match; the project must be deployed. |
| "Could not read Pons V2 configuration" | RPC unreachable or rate-limited; set `ROBINHOOD_RPC_URL`. |
| "Token launching is currently unavailable for this wallet" | `canLaunch()` returned false on-chain (public launches closed and wallet not whitelisted). |
| "Pons launch terms changed…" | `LaunchEconomicsMismatch`: review the refreshed terms and sign again. |
| WalletConnect missing | Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. |
| "Claude could not complete this change" + log `22P05 … has no equivalent in encoding "WIN1252"` | The database is not UTF-8 (common with native Postgres on Windows). Create it with `CREATE DATABASE prismatic WITH ENCODING 'UTF8' TEMPLATE template0;` (the Docker `postgres` image is UTF-8 by default). |
