-- Make peer IPs releasable so revoked peers don't hold an address forever.
-- The unique (serverId, assignedIp) constraint applies to all rows, so a revoked
-- peer keeping its IP collided with new allocations. Allow NULL and reclaim the
-- IPs of already-revoked peers.

-- AlterTable
ALTER TABLE "wireguard_peers" ALTER COLUMN "assignedIp" DROP NOT NULL;

-- Reclaim IPs from existing revoked peers so the allocator can reuse them.
UPDATE "wireguard_peers" SET "assignedIp" = NULL WHERE "status" = 'REVOKED';
