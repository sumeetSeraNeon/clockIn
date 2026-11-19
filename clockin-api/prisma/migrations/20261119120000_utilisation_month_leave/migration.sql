-- CreateTable
CREATE TABLE "utilisation_months" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "planned_hours" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "utilisation_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_entries" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "leave_days" DECIMAL(6,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leave_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "utilisation_months_organisation_id_idx" ON "utilisation_months"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "utilisation_months_organisation_id_year_month_key" ON "utilisation_months"("organisation_id", "year_month");

-- CreateIndex
CREATE INDEX "leave_entries_organisation_id_idx" ON "leave_entries"("organisation_id");

-- CreateIndex
CREATE INDEX "leave_entries_user_id_idx" ON "leave_entries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_entries_organisation_id_user_id_year_month_key" ON "leave_entries"("organisation_id", "user_id", "year_month");

-- AddForeignKey
ALTER TABLE "utilisation_months" ADD CONSTRAINT "utilisation_months_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_entries" ADD CONSTRAINT "leave_entries_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_entries" ADD CONSTRAINT "leave_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
