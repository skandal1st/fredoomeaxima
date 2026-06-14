# Multi-stage build for the NestJS API in a pnpm monorepo.
FROM node:20-bookworm-slim AS base
# Prisma's engines need OpenSSL (the slim image ships without libssl) — install it
# in the shared base so both `prisma generate` (build) and migrate/runtime detect
# the correct engine (debian-openssl-3.0.x) instead of failing.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# ── deps ──
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/agent/package.json apps/agent/
RUN pnpm install --frozen-lockfile=false

# ── build ──
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/agent apps/agent
RUN pnpm --filter @aximavpn/shared build \
 && pnpm --filter @aximavpn/agent build \
 && pnpm --filter @aximavpn/api prisma:generate \
 && pnpm --filter @aximavpn/api build

# ── runtime ──
FROM base AS runtime
ENV NODE_ENV=production
# Path the SSH provisioner reads the agent bundle from (uploaded to nodes via SFTP).
ENV AGENT_BUNDLE_PATH=/repo/apps/agent/dist/index.js
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/packages/shared/dist /repo/packages/shared/dist
COPY --from=build /repo/packages/shared/package.json /repo/packages/shared/package.json
# shared's own deps (zod) are symlinked here into the root .pnpm store (already copied).
COPY --from=build /repo/packages/shared/node_modules /repo/packages/shared/node_modules
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/apps/api/package.json /repo/apps/api/package.json
COPY --from=build /repo/apps/api/prisma /repo/apps/api/prisma
# Agent bundle for SSH provisioning.
COPY --from=build /repo/apps/agent/dist /repo/apps/agent/dist
WORKDIR /repo/apps/api
EXPOSE 4000
# Apply migrations then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
