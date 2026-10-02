-- FIX 1 (refine): backfill project_members for anyone who has an assigned task,
-- so existing assignees can still see/log on those projects after assignee is no
-- longer a hard access gate. Empty teams stay empty otherwise.

INSERT INTO "project_members" (
  "id",
  "organisation_id",
  "project_id",
  "membership_id",
  "role_on_project",
  "status",
  "added_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  t."organisation_id",
  t."project_id",
  t."assignee_id",
  'contributor',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "organisation_id", "project_id", "assignee_id"
  FROM "tasks"
  WHERE "assignee_id" IS NOT NULL
) t
ON CONFLICT ("project_id", "membership_id") DO NOTHING;
