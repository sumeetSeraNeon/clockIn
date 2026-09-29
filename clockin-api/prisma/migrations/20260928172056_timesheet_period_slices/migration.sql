-- AlterTable
ALTER TABLE "approvals" ADD COLUMN     "timesheet_period_slice_id" TEXT;

-- CreateTable
CREATE TABLE "timesheet_period_slices" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "timesheet_period_id" TEXT NOT NULL,
    "project_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "decided_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "timesheet_period_slices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheet_period_slices_organisation_id_idx" ON "timesheet_period_slices"("organisation_id");

-- CreateIndex
CREATE INDEX "timesheet_period_slices_timesheet_period_id_idx" ON "timesheet_period_slices"("timesheet_period_id");

-- CreateIndex
CREATE INDEX "timesheet_period_slices_project_id_idx" ON "timesheet_period_slices"("project_id");

-- CreateIndex
CREATE INDEX "timesheet_period_slices_status_idx" ON "timesheet_period_slices"("status");

-- AddForeignKey
ALTER TABLE "timesheet_period_slices" ADD CONSTRAINT "timesheet_period_slices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_period_slices" ADD CONSTRAINT "timesheet_period_slices_timesheet_period_id_fkey" FOREIGN KEY ("timesheet_period_id") REFERENCES "timesheet_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_period_slices" ADD CONSTRAINT "timesheet_period_slices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
