-- Tariffs: decouple "shown in public catalogue" from "active", and support
-- soft-delete (archive) so a tariff referenced by subscriptions/payments can be
-- removed from lists without losing history.

-- AlterTable
ALTER TABLE "tariffs"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
