# Deploying Aestrodom

This guide takes a fresh Linux server to a running `prismatic.com` with automatic HTTPS for the
main app, every deployed project (`{slug}.prismatic.com`) and every live preview
(`{slug}.preview.prismatic.com`).

```text
Internet
   ↓
Cloudflare / DNS          (A  prismatic.com, *.prismatic.com, *.preview.prismatic.com → SERVER_IP)
   ↓
Caddy                     (TLS, host-based routing)
   ├── prismatic.com ───────────────► Aestrodom App (Next.js) ──► PostgreSQL, Redis
   ├── {slug}.prismatic.com ────────► site-{slug}     ┐
   └── {slug}.preview.prismatic.com ► preview-{slug}  ┘ Project containers (internal network, no egress)
                                                        ▲
                       Aestrodom App ── Docker API (socket proxy, restricted) ──┘

Aestrodom backend ──► Claude API            Browser wallet ──► Robinhood Chain (4663) ──► Pons V2
```

All projects share one host and one proxy. Each project runs in its own container; no project gets
its own VPS.

## 1. Buy the domain

Register `prismatic.com` (or your own domain; set `PRISMATIC_DOMAIN` accordingly). The Caddyfile
assumes a two-label base domain such as `example.com`; for `app.example.co.uk`-style domains adjust
the `{labels.N}` indexes in `deploy/Caddyfile`.

## 2. Configure wildcard DNS

At your DNS provider create:

| Type | Host        | Value       |
|------|-------------|-------------|
| A    | `@`         | `SERVER_IP` |
| A    | `*`         | `SERVER_IP` |
| A    | `*.preview` | `SERVER_IP` |

`*` makes every `{slug}.prismatic.com` resolve to the deployment server; `*.preview` does the same
for previews (a single-label wildcard does not cover two labels). With Cloudflare, use **DNS only**
(grey cloud) for the wildcard records so Caddy can complete ACME HTTP/TLS challenges, or switch to a
DNS-01 challenge (see §5).

## 3. Prepare the server

```bash
# Ubuntu 22.04+/Debian 12
curl -fsSL https://get.docker.com | sh
git clone <your repo> prismatic && cd prismatic

# Build the sandbox runtime image used by every project container
docker build -t prismatic-runtime:latest runtime
```

## 4. Configure environment

```bash
cd deploy
cp ../.env.example .env
```

Set at least:

| Variable | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://prismatic.com` |
| `ANTHROPIC_API_KEY` | your Claude API key |
| `PRISMATIC_DOMAIN` | `prismatic.com` |
| `PRISMATIC_PREVIEW_DOMAIN` | `preview.prismatic.com` |
| `CADDY_ASK_SECRET` | `openssl rand -hex 24` |
| `POSTGRES_PASSWORD` | strong random value |
| `ACME_EMAIL` | contact email for Let's Encrypt |
| `ROBINHOOD_RPC_URL` | a Robinhood Chain RPC (a private, credentialed URL is fine here — it is server-only) |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | a **public** RPC URL (shipped to browsers) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | from cloud.reown.com (optional; enables WalletConnect) |
| `PONS_V2_*` | verify against https://docs.ponsfamily.com/docs/v2 |

`DEPLOYMENT_MODE`, `DOCKER_HOST`, `STORAGE_PATH`, `REDIS_URL` and `DATABASE_URL` are set by
`docker-compose.yml`.

## 5. TLS

Caddy obtains certificates automatically:

- `prismatic.com` / `www` — issued at startup.
- `{slug}.prismatic.com` and `{slug}.preview.prismatic.com` — **on-demand TLS**. Before issuing,
  Caddy calls `GET /api/internal/domain-check?domain=…&secret=CADDY_ASK_SECRET`; the app only
  approves hosts of running deployments/previews. This stops anyone from making you request
  certificates for arbitrary subdomains.

Alternative: a single wildcard certificate via DNS-01. Build Caddy with your DNS provider module
(`xcaddy build --with github.com/caddy-dns/cloudflare`) and replace the `tls { on_demand }` blocks
with `tls { dns cloudflare {env.CF_API_TOKEN} }`.

## 6. Start

```bash
cd deploy
docker compose up -d --build
docker compose logs -f app       # migrations run automatically on start
```

Create your account at `https://prismatic.com/register`, then promote it:

```bash
docker compose exec app node scripts/make-admin.mjs you@example.com
```

## 7. How a deploy works

1. User clicks **Deploy** → `POST /api/projects/:id/deploy` (ownership verified).
2. The app ensures `prismatic-prod-{projectId}` exists (runtime image, non-root, caps dropped,
   memory/CPU/PID limits, no mounts, no env) on the `prismatic_projects` network with DNS alias
   `site-{slug}`.
3. Files are copied in via the Docker archive API, then `build.mjs` type-checks and builds with a
   fixed Vite config. On success the served directory is swapped atomically (zero-downtime redeploys;
   a failed redeploy keeps the previous version live).
4. The deployment is recorded as `RUNNING`; Caddy now routes `{slug}.prismatic.com` → `site-{slug}:3000`
   and the ask endpoint approves its certificate.

**Stop** stops the container and marks the deployment `STOPPED`; Caddy then returns 404 for the host.

## 8. Operations

- **Backups:** `pg_dump` the `prismatic` database. Project sources are mirrored in the `ProjectFile`
  table, so a database backup is sufficient to restore working copies (`restoreFromDatabase`).
- **Scaling:** run more app replicas behind Caddy with shared Postgres + Redis (rate limits are
  Redis-backed). Agent-run locking is per process; pin a project's AI requests to one replica (e.g.
  sticky sessions) or move the lock to Redis before scaling horizontally.
- **Idle previews:** preview containers use `restart: no`; a nightly `docker container prune
  --filter label=prismatic.kind=preview` reclaims stopped ones. The builder's **Start preview**
  button recreates them on demand.
- **Logs:** the app logs structured JSON to stdout with secrets redacted.

## Local development

```bash
cp .env.example .env            # DEPLOYMENT_MODE=local
docker compose -f deploy/docker-compose.dev.yml up -d   # Postgres only (optional)
npm install
npx prisma migrate dev
npm run runtime:build           # requires Docker Desktop
npm run dev
```

In `local` mode project containers publish their port on `127.0.0.1` only and the preview/deploy URLs
are `http://127.0.0.1:{port}` (a different site from `localhost:3000`, so preview code cannot reach
the app's cookies).
