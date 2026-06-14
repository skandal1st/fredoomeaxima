# AximaVPN

Self-hostable SaaS WireGuard VPN with **split tunneling** (route only selected
services — Telegram, YouTube, Instagram, TikTok, ChatGPT, Claude, Gemini,
WhatsApp — through the VPN), a user dashboard, billing, and an admin panel for
managing users, tariffs, payments and a fleet of WireGuard servers.

> MVP scaffold built to grow into a commercial product — modular, typed, and
> production-shaped (no throwaway mock architecture).

## Stack

| Layer            | Tech                                             |
| ---------------- | ------------------------------------------------ |
| Backend API      | NestJS (Node 20, TypeScript)                     |
| Frontend         | Next.js 14 (App Router) — dashboard + admin      |
| Database         | PostgreSQL 16 + Prisma                           |
| Cache / queue    | Redis 7 (rate limiting; BullMQ-ready)            |
| VPN              | WireGuard + per-server Node agent                |
| Payments         | Provider-agnostic (Mock + YooKassa adapter)      |
| Notifications    | Telegram Bot API                                 |
| Reverse proxy    | Traefik v3                                        |
| Deploy           | Docker Compose                                   |

Monorepo via pnpm workspaces:

```
apps/
  api/      NestJS panel API + Prisma schema/migrations/seed
  web/      Next.js dashboard + admin
  agent/    Node agent that runs on each WireGuard VPS
packages/
  shared/   Shared enums, zod DTOs, route-group seeds
scripts/
  install-wg-server.sh   VPS bootstrap (WireGuard + agent + register)
```

## Architecture in one minute

- **Panel API** is the source of truth (users, subscriptions, peers, servers).
- **Split tunnel**: WireGuard routes by IP, so a `route-resolver` job resolves
  each route group's domains to CIDRs, stores a **versioned route list**, and
  flags peers built on an older version as `needsUpdate`. A peer's `AllowedIPs`
  is the current version's CIDRs — only that traffic goes through the VPN.
- **Servers**: admin adds a server → panel returns a one-line install command.
  The script installs WireGuard + the agent and **self-registers** with a
  one-time install token. The panel then **pushes** peer add/remove over the
  agent's token-authenticated HTTP API; the agent pushes heartbeats back.
- **Health**: scheduled checks (panel reachability + agent target-checks from
  inside the country) record results, flip server status, and alert admins on
  Telegram.

See `packages/shared/src/route-groups.ts` for the seeded split-tunnel services.

## Quick start (local dev)

Prereqs: Node 20+, pnpm 9+, Docker.

```bash
cp .env.example .env
# Generate real secrets:
#   ENCRYPTION_KEY:  openssl rand -hex 32
#   JWT_* secrets:   openssl rand -hex 48
# and paste them into .env

pnpm install

# 1) datastores
docker compose up -d postgres redis

# 2) database
pnpm --filter @aximavpn/shared build
pnpm db:migrate          # prisma migrate dev
pnpm db:seed             # admin + tariff + countries + route groups

# 3) run API and web (two terminals)
pnpm dev:api             # http://localhost:4000  (Swagger at /api/docs)
pnpm dev:web             # http://localhost:3000
```

Sign in to the admin panel with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
Register a normal user from the web UI to see the dashboard.

### Full stack via Docker

```bash
docker compose up -d            # postgres, redis, api, web, traefik
# api applies migrations on boot; run the seed once:
docker compose exec api npx prisma db seed
```

## Production deployment (single VPS, e.g. freedome.aximatech.ru)

The panel runs behind Traefik with Let's Encrypt TLS. Web is served at
`https://<domain>` and the API at `https://<domain>/api` (Traefik strips `/api`).

1. **DNS** — point an A record for your domain at the VPS **first** (ACME needs
   it to resolve before issuing a certificate).
2. On the VPS (fresh Ubuntu 22.04/24.04), get the repo and configure env:
   ```bash
   cp .env.production.example .env   # edit PANEL_DOMAIN, ACME_EMAIL, secrets
   sudo bash scripts/deploy-panel.sh
   ```
   The script installs Docker, opens the firewall (22, 80, 443, 51820/udp,
   8443/tcp), builds the images, starts the stack, and seeds the database.
3. Open `https://<domain>` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Adding a VPN server (panel-driven, over SSH)

The panel provisions servers itself — no manual SSH needed.

1. Admin panel → **Servers** → **Add server**: name, country, **public IP**,
   **SSH user + password**, WG port, capacity, cost. Keep **“Deploy over SSH
   now”** checked.
2. The panel connects over SSH, uploads the agent + a token-injected install
   script, runs it (installing WireGuard + the agent), and the server
   self-registers → status `ACTIVE`. A **live log** streams in the UI.
3. The SSH password is used only during provisioning and **never stored**. If a
   deploy fails, use **Retry** on the server row (re-enter the password).

> **First node = the panel VPS.** Add a server whose IP is this VPS's own public
> IP with its SSH credentials; the agent runs on the host (port 8443) and the
> panel reaches it at `http://<ip>:8443`.

> **Manual fallback:** uncheck “Deploy over SSH” to get a `curl … | sudo bash`
> one-liner instead. The agent bundle is served at `<PANEL_URL>/servers/agent-bundle`.

## Payments

`PAYMENT_PROVIDER=mock` (default) settles instantly so the whole grant flow is
testable. Set `PAYMENT_PROVIDER=yookassa` plus `YOOKASSA_SHOP_ID` /
`YOOKASSA_SECRET_KEY` to use the RU/CIS card adapter
(`apps/api/src/payments/providers/yookassa.provider.ts`). Admins can also mark a
pending payment as paid manually (Payments page).

## Security notes

- Passwords hashed with **argon2id**; JWT access + rotating refresh tokens
  (hashes stored, revoked on logout/block).
- RBAC via `@Roles(ADMIN)`; global JWT guard with `@Public()` opt-outs.
- Sensitive columns (peer private/preshared keys, agent tokens) encrypted with
  **AES-256-GCM** (`ENCRYPTION_KEY`).
- Rate limiting on `/auth/*`; zod validation on inputs; config validated at boot.
- All admin mutations recorded in the audit log.
- Restrict each agent's port to the panel's IP (firewall) in production and
  front the agent with a real TLS cert (the gateway currently allows self-signed
  for dev).

## Known limitations (by design for MVP)

- Domain→IP coverage for split tunnel is approximate (CDNs, QUIC, rotating
  ranges). The route list re-resolves on a schedule and supports manual CIDRs.
- Peer private keys are generated server-side and stored encrypted (simplifies
  QR/`.conf` delivery). Client-side key generation is a future hardening option.
- Cross-currency margin uses per-currency subtotals (no FX conversion yet).

## Useful scripts

```bash
pnpm build        # build all workspaces
pnpm lint         # typecheck all workspaces
pnpm db:generate  # prisma generate
```
