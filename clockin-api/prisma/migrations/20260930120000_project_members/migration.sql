-- STEP 1: project membership (who is ON a project, independent of tasks)
-- Empty table only — no backfill; teams are added manually in the app.

CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role_on_project" TEXT NOT NULL DEFAULT 'contributor',
    "status" TEXT NOT NULL DEFAULT 'active',
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_members_project_id_membership_id_key" ON "project_members"("project_id", "membership_id");
CREATE INDEX "project_members_organisation_id_idx" ON "project_members"("organisation_id");
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");
CREATE INDEX "project_members_membership_id_idx" ON "project_members"("membership_id");
CREATE INDEX "project_members_status_idx" ON "project_members"("status");

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
