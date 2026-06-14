-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('PAYMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED', 'MAINTENANCE', 'UNREACHABLE');

-- CreateEnum
CREATE TYPE "PeerStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ServerCostStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "durationDays" INTEGER NOT NULL,
    "deviceLimit" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "SubscriptionSource" NOT NULL DEFAULT 'PAYMENT',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tariffId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flagEmoji" TEXT,

    CONSTRAINT "vpn_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "sshUser" TEXT NOT NULL DEFAULT 'root',
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "wgEndpointPort" INTEGER NOT NULL DEFAULT 51820,
    "agentUrl" TEXT NOT NULL,
    "agentTokenEnc" TEXT,
    "serverPublicKey" TEXT,
    "maxPeers" INTEGER NOT NULL DEFAULT 200,
    "status" "ServerStatus" NOT NULL DEFAULT 'PENDING',
    "installToken" TEXT,
    "registeredAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "monthlyCostCents" INTEGER NOT NULL DEFAULT 0,
    "costCurrency" TEXT NOT NULL DEFAULT 'USD',
    "provider" TEXT,
    "nextRenewalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wireguard_peers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "label" TEXT,
    "publicKey" TEXT NOT NULL,
    "privateKeyEnc" TEXT NOT NULL,
    "presharedKeyEnc" TEXT NOT NULL,
    "assignedIp" TEXT NOT NULL,
    "status" "PeerStatus" NOT NULL DEFAULT 'ACTIVE',
    "routeListVersionId" TEXT,
    "needsUpdate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wireguard_peers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_groups" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domains" TEXT[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_list_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_list_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_entries" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "routeGroupId" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_health_checks" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reachable" BOOLEAN NOT NULL DEFAULT false,
    "wgPortOpen" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER,
    "dnsOk" BOOLEAN NOT NULL DEFAULT false,
    "targetResults" JSONB,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "detail" TEXT,

    CONSTRAINT "server_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_cost_records" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ServerCostStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_cost_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TariffCountries" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerTxnId_key" ON "payments"("providerTxnId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_countries_code_key" ON "vpn_countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_servers_installToken_key" ON "vpn_servers"("installToken");

-- CreateIndex
CREATE INDEX "vpn_servers_countryId_status_idx" ON "vpn_servers"("countryId", "status");

-- CreateIndex
CREATE INDEX "wireguard_peers_userId_status_idx" ON "wireguard_peers"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wireguard_peers_serverId_assignedIp_key" ON "wireguard_peers"("serverId", "assignedIp");

-- CreateIndex
CREATE UNIQUE INDEX "wireguard_peers_serverId_publicKey_key" ON "wireguard_peers"("serverId", "publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "route_groups_key_key" ON "route_groups"("key");

-- CreateIndex
CREATE UNIQUE INDEX "route_list_versions_version_key" ON "route_list_versions"("version");

-- CreateIndex
CREATE INDEX "route_entries_versionId_idx" ON "route_entries"("versionId");

-- CreateIndex
CREATE INDEX "route_entries_routeGroupId_idx" ON "route_entries"("routeGroupId");

-- CreateIndex
CREATE INDEX "server_health_checks_serverId_checkedAt_idx" ON "server_health_checks"("serverId", "checkedAt");

-- CreateIndex
CREATE INDEX "server_cost_records_serverId_idx" ON "server_cost_records"("serverId");

-- CreateIndex
CREATE INDEX "admin_actions_adminId_createdAt_idx" ON "admin_actions"("adminId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_TariffCountries_AB_unique" ON "_TariffCountries"("A", "B");

-- CreateIndex
CREATE INDEX "_TariffCountries_B_index" ON "_TariffCountries"("B");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "tariffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_servers" ADD CONSTRAINT "vpn_servers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "vpn_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wireguard_peers" ADD CONSTRAINT "wireguard_peers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wireguard_peers" ADD CONSTRAINT "wireguard_peers_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "vpn_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wireguard_peers" ADD CONSTRAINT "wireguard_peers_routeListVersionId_fkey" FOREIGN KEY ("routeListVersionId") REFERENCES "route_list_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_entries" ADD CONSTRAINT "route_entries_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "route_list_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_entries" ADD CONSTRAINT "route_entries_routeGroupId_fkey" FOREIGN KEY ("routeGroupId") REFERENCES "route_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_health_checks" ADD CONSTRAINT "server_health_checks_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "vpn_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_cost_records" ADD CONSTRAINT "server_cost_records_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "vpn_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TariffCountries" ADD CONSTRAINT "_TariffCountries_A_fkey" FOREIGN KEY ("A") REFERENCES "tariffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TariffCountries" ADD CONSTRAINT "_TariffCountries_B_fkey" FOREIGN KEY ("B") REFERENCES "vpn_countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

