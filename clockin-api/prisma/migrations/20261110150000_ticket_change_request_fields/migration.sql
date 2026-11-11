-- Change Request fields on tickets + rename type change → change_request
-- Stub ticket_attachments table (upload/storage later)

-- 1. CR commercial columns
ALTER TABLE "tickets" ADD COLUMN "cr_approval_status" TEXT;
ALTER TABLE "tickets" ADD COLUMN "cr_value" DECIMAL(14,2);
ALTER TABLE "tickets" ADD COLUMN "cr_value_currency" TEXT;

-- 2. Migrate stored ticket type
UPDATE "tickets" SET "ticket_type" = 'change_request' WHERE "ticket_type" = 'change';

CREATE INDEX "tickets_cr_approval_status_idx" ON "tickets"("cr_approval_status");

-- 3. Stub attachments table
CREATE TABLE "ticket_attachments" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ticket_attachments_organisation_id_idx" ON "ticket_attachments"("organisation_id");
CREATE INDEX "ticket_attachments_ticket_id_idx" ON "ticket_attachments"("ticket_id");

ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
