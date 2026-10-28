-- Freshdesk ticket fields + ticket groups.
-- Legacy status in_progress → pending.

CREATE TABLE "ticket_groups" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ticket_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_groups_organisation_id_name_key" ON "ticket_groups"("organisation_id", "name");
CREATE INDEX "ticket_groups_organisation_id_idx" ON "ticket_groups"("organisation_id");
CREATE INDEX "ticket_groups_status_idx" ON "ticket_groups"("status");

ALTER TABLE "ticket_groups" ADD CONSTRAINT "ticket_groups_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tickets" ADD COLUMN "group_id" TEXT,
ADD COLUMN "ticket_priority" TEXT,
ADD COLUMN "agent_name" TEXT,
ADD COLUMN "internal_agent_name" TEXT,
ADD COLUMN "contact_name" TEXT,
ADD COLUMN "contact_email" TEXT,
ADD COLUMN "contact_external_id" TEXT,
ADD COLUMN "source" TEXT,
ADD COLUMN "tags" TEXT,
ADD COLUMN "workstream" TEXT,
ADD COLUMN "due_at" TIMESTAMPTZ,
ADD COLUMN "closed_at" TIMESTAMPTZ,
ADD COLUMN "initial_response_at" TIMESTAMPTZ,
ADD COLUMN "first_response_seconds" INTEGER,
ADD COLUMN "resolution_seconds" INTEGER;

CREATE INDEX "tickets_group_id_idx" ON "tickets"("group_id");
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ticket_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "tickets" SET "status" = 'pending' WHERE "status" = 'in_progress';
