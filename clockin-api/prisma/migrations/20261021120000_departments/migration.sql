-- Departments (Clockify groups) and membership links.
-- Backfill from the free-text memberships.department column.

CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "department_members" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_organisation_id_name_key" ON "departments"("organisation_id", "name");
CREATE INDEX "departments_organisation_id_idx" ON "departments"("organisation_id");
CREATE INDEX "departments_status_idx" ON "departments"("status");

CREATE UNIQUE INDEX "department_members_department_id_membership_id_key" ON "department_members"("department_id", "membership_id");
CREATE INDEX "department_members_organisation_id_idx" ON "department_members"("organisation_id");
CREATE INDEX "department_members_membership_id_idx" ON "department_members"("membership_id");

ALTER TABLE "departments" ADD CONSTRAINT "departments_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "department_members" ADD CONSTRAINT "department_members_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One department per org + trimmed name (case-insensitive collapse).
INSERT INTO "departments" ("id", "organisation_id", "name", "status", "created_at", "updated_at")
SELECT gen_random_uuid()::text,
       grouped.organisation_id,
       grouped.name,
       'active',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM (
  SELECT organisation_id, MIN(TRIM(department)) AS name
  FROM "memberships"
  WHERE department IS NOT NULL AND TRIM(department) <> ''
  GROUP BY organisation_id, LOWER(TRIM(department))
) AS grouped;

INSERT INTO "department_members" ("id", "organisation_id", "department_id", "membership_id", "created_at")
SELECT gen_random_uuid()::text,
       m.organisation_id,
       d.id,
       m.id,
       CURRENT_TIMESTAMP
FROM "memberships" m
JOIN "departments" d
  ON d.organisation_id = m.organisation_id
 AND LOWER(d.name) = LOWER(TRIM(m.department))
WHERE m.department IS NOT NULL AND TRIM(m.department) <> '';
