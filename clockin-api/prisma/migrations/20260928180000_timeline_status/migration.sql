-- AlterTable
ALTER TABLE "time_lines" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';

UPDATE "time_lines" AS tl
SET "status" = te."status"
FROM "time_entries" AS te
WHERE tl."time_entry_id" = te."id"
  AND te."status" IN ('draft', 'submitted', 'approved', 'rejected', 'locked');

UPDATE "time_lines" SET "status" = 'approved' WHERE "status" = 'locked';

CREATE INDEX "time_lines_status_idx" ON "time_lines"("status");