-- CreateEnum
CREATE TYPE "ProvisionStatus" AS ENUM ('NONE', 'RUNNING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "vpn_servers"
  ADD COLUMN "provisionStatus" "ProvisionStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "provisionLog" TEXT;
