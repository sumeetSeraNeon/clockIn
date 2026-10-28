-- Freshdesk Group → Department: replace ticket_groups with departments FK

-- 1. Add department_id
ALTER TABLE "tickets" ADD COLUMN "department_id" TEXT;

-- 2. Backfill by matching ticket_groups.name to departments.name (case-insensitive, same org)
UPDATE "tickets" t
SET "department_id" = d.id
FROM "ticket_groups" g
JOIN "departments" d
  ON d.organisation_id = g.organisation_id
 AND lower(d.name) = lower(g.name)
WHERE t.group_id = g.id
  AND t.department_id IS NULL;

-- 3. Drop old group FK / column / index
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_group_id_fkey";
DROP INDEX IF EXISTS "tickets_group_id_idx";
ALTER TABLE "tickets" DROP COLUMN IF EXISTS "group_id";

-- 4. Drop ticket_groups
DROP TABLE IF EXISTS "ticket_groups";

-- 5. Index + FK for department_id
CREATE INDEX "tickets_department_id_idx" ON "tickets"("department_id");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
