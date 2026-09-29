-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "auth_provider" TEXT,
    "timezone" TEXT,
    "is_contractor" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "member_type" TEXT NOT NULL DEFAULT 'staff',
    "client_id" TEXT,
    "department" TEXT,
    "manager_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_roles" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "currency" TEXT,
    "owner_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "external_ref" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "owner_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "budget_hours" DECIMAL(12,2),
    "budget_value" DECIMAL(14,2),
    "billable_by_default" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignee_id" TEXT,
    "estimated_hours" DECIMAL(12,2),
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "reference" TEXT NOT NULL,
    "ticket_type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT,
    "raised_by" TEXT,
    "opened_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "start_time" TIMESTAMPTZ,
    "end_time" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'timer',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_lines" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "time_entry_id" TEXT NOT NULL,
    "task_id" TEXT,
    "project_id" TEXT,
    "client_id" TEXT,
    "cr_id" TEXT,
    "ticket_id" TEXT,
    "ticket_type" TEXT,
    "area" TEXT,
    "cr_number" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "is_first_line" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "time_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_line_tags" (
    "id" TEXT NOT NULL,
    "time_line_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "time_line_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rates" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "rate_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "client_id" TEXT,
    "project_id" TEXT,
    "user_id" TEXT,
    "task_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_calendar" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT,
    "weekly_hours" DECIMAL(6,2),
    "workdays" TEXT,
    "effective_from" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "working_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT,
    "holiday_date" DATE,
    "country" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "cr_number" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "value_amount" DECIMAL(14,2),
    "value_currency" TEXT,
    "budget_hours" DECIMAL(12,2),
    "approved_by" TEXT,
    "approved_at" TIMESTAMPTZ,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cr_consumption" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "cr_id" TEXT NOT NULL,
    "consumed_hours" DECIMAL(12,2),
    "consumed_value" DECIMAL(14,2),
    "last_calculated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cr_consumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overrun_attempts" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "cr_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "attempted_date" DATE,
    "attempted_minutes" INTEGER,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overrun_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "invoice_number" TEXT,
    "issue_date" DATE,
    "due_date" DATE,
    "total_amount" DECIMAL(14,2),
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_invoiced',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_allocations" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "cr_id" TEXT,
    "project_id" TEXT,
    "amount" DECIMAL(14,2),
    "hours" DECIMAL(12,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_periods" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "timesheet_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "timesheet_period_id" TEXT,
    "approver_id" TEXT,
    "decision" TEXT,
    "reason" TEXT,
    "decided_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "client_id" TEXT,
    "cr_id" TEXT,
    "category" TEXT,
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "quantity" DECIMAL(12,2),
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "receipt_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "expense_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off_policies" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT,
    "unit" TEXT,
    "accrual_rule" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "time_off_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off_requests" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "policy_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "hours" DECIMAL(8,2),
    "status" TEXT NOT NULL DEFAULT 'requested',
    "approver_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "time_off_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "cr_id" TEXT,
    "project_id" TEXT,
    "forecast_type" TEXT,
    "projected_date" DATE,
    "projected_value" DECIMAL(14,2),
    "calculated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "rule_type" TEXT,
    "threshold" TEXT,
    "target_role" TEXT,
    "channel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alert_rule_id" TEXT,
    "title" TEXT,
    "body" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_flags" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "risk_type" TEXT,
    "severity" TEXT,
    "detail" TEXT,
    "detected_at" TIMESTAMPTZ,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "seats" INTEGER,
    "status" TEXT,
    "trial_ends_at" TIMESTAMPTZ,
    "stripe_customer_id" TEXT,
    "current_period_end" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_defs" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "entity_type" TEXT,
    "field_key" TEXT,
    "field_label" TEXT,
    "field_type" TEXT,
    "options" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_field_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "field_def_id" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configurable_work_types" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "kind" TEXT,
    "value" TEXT,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "configurable_work_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branding" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "primary_color" TEXT,
    "email_from_name" TEXT,
    "custom_domain" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT,
    "key_hash" TEXT,
    "scopes" TEXT,
    "created_by" TEXT,
    "last_used_at" TIMESTAMPTZ,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "target_url" TEXT,
    "event_types" TEXT,
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_profiles" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "supplier_name" TEXT,
    "contract_rate" DECIMAL(14,2),
    "currency" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contractor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "contractor_profile_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "period_start" DATE,
    "period_end" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_access" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "can_view_invoices" BOOLEAN NOT NULL DEFAULT true,
    "can_view_crs" BOOLEAN NOT NULL DEFAULT true,
    "can_view_tickets" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "portal_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT,
    "trigger_event" TEXT,
    "condition" JSONB,
    "action" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT,
    "feature" TEXT,
    "input" TEXT,
    "output" TEXT,
    "accepted" BOOLEAN,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_organisation_id_idx" ON "memberships"("organisation_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organisation_id_user_id_key" ON "memberships"("organisation_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_organisation_id_idx" ON "roles"("organisation_id");

-- CreateIndex
CREATE INDEX "membership_roles_membership_id_idx" ON "membership_roles"("membership_id");

-- CreateIndex
CREATE INDEX "membership_roles_role_id_idx" ON "membership_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_roles_membership_id_role_id_key" ON "membership_roles"("membership_id", "role_id");

-- CreateIndex
CREATE INDEX "permissions_role_id_idx" ON "permissions"("role_id");

-- CreateIndex
CREATE INDEX "clients_organisation_id_idx" ON "clients"("organisation_id");

-- CreateIndex
CREATE INDEX "clients_owner_id_idx" ON "clients"("owner_id");

-- CreateIndex
CREATE INDEX "projects_organisation_id_idx" ON "projects"("organisation_id");

-- CreateIndex
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");

-- CreateIndex
CREATE INDEX "tasks_organisation_id_idx" ON "tasks"("organisation_id");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tickets_organisation_id_idx" ON "tickets"("organisation_id");

-- CreateIndex
CREATE INDEX "tickets_client_id_idx" ON "tickets"("client_id");

-- CreateIndex
CREATE INDEX "tickets_project_id_idx" ON "tickets"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_organisation_id_reference_key" ON "tickets"("organisation_id", "reference");

-- CreateIndex
CREATE INDEX "time_entries_organisation_id_entry_date_idx" ON "time_entries"("organisation_id", "entry_date");

-- CreateIndex
CREATE INDEX "time_entries_user_id_entry_date_idx" ON "time_entries"("user_id", "entry_date");

-- CreateIndex
CREATE INDEX "time_lines_organisation_id_cr_id_idx" ON "time_lines"("organisation_id", "cr_id");

-- CreateIndex
CREATE INDEX "time_lines_organisation_id_task_id_idx" ON "time_lines"("organisation_id", "task_id");

-- CreateIndex
CREATE INDEX "time_lines_time_entry_id_idx" ON "time_lines"("time_entry_id");

-- CreateIndex
CREATE INDEX "time_lines_project_id_idx" ON "time_lines"("project_id");

-- CreateIndex
CREATE INDEX "time_lines_client_id_idx" ON "time_lines"("client_id");

-- CreateIndex
CREATE INDEX "time_lines_ticket_id_idx" ON "time_lines"("ticket_id");

-- CreateIndex
CREATE INDEX "tags_organisation_id_idx" ON "tags"("organisation_id");

-- CreateIndex
CREATE INDEX "time_line_tags_time_line_id_idx" ON "time_line_tags"("time_line_id");

-- CreateIndex
CREATE INDEX "time_line_tags_tag_id_idx" ON "time_line_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "time_line_tags_time_line_id_tag_id_key" ON "time_line_tags"("time_line_id", "tag_id");

-- CreateIndex
CREATE INDEX "rates_organisation_id_rate_type_scope_idx" ON "rates"("organisation_id", "rate_type", "scope");

-- CreateIndex
CREATE INDEX "rates_client_id_idx" ON "rates"("client_id");

-- CreateIndex
CREATE INDEX "rates_project_id_idx" ON "rates"("project_id");

-- CreateIndex
CREATE INDEX "rates_user_id_idx" ON "rates"("user_id");

-- CreateIndex
CREATE INDEX "rates_task_id_idx" ON "rates"("task_id");

-- CreateIndex
CREATE INDEX "working_calendar_organisation_id_idx" ON "working_calendar"("organisation_id");

-- CreateIndex
CREATE INDEX "working_calendar_user_id_idx" ON "working_calendar"("user_id");

-- CreateIndex
CREATE INDEX "holidays_organisation_id_idx" ON "holidays"("organisation_id");

-- CreateIndex
CREATE INDEX "audit_events_organisation_id_entity_type_entity_id_idx" ON "audit_events"("organisation_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_idx" ON "audit_events"("actor_id");

-- CreateIndex
CREATE INDEX "change_requests_organisation_id_idx" ON "change_requests"("organisation_id");

-- CreateIndex
CREATE INDEX "change_requests_client_id_idx" ON "change_requests"("client_id");

-- CreateIndex
CREATE INDEX "change_requests_project_id_idx" ON "change_requests"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_requests_organisation_id_cr_number_key" ON "change_requests"("organisation_id", "cr_number");

-- CreateIndex
CREATE INDEX "cr_consumption_organisation_id_idx" ON "cr_consumption"("organisation_id");

-- CreateIndex
CREATE INDEX "cr_consumption_cr_id_idx" ON "cr_consumption"("cr_id");

-- CreateIndex
CREATE INDEX "overrun_attempts_organisation_id_idx" ON "overrun_attempts"("organisation_id");

-- CreateIndex
CREATE INDEX "overrun_attempts_cr_id_idx" ON "overrun_attempts"("cr_id");

-- CreateIndex
CREATE INDEX "overrun_attempts_user_id_idx" ON "overrun_attempts"("user_id");

-- CreateIndex
CREATE INDEX "invoices_organisation_id_idx" ON "invoices"("organisation_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_project_id_idx" ON "invoices"("project_id");

-- CreateIndex
CREATE INDEX "invoice_allocations_organisation_id_idx" ON "invoice_allocations"("organisation_id");

-- CreateIndex
CREATE INDEX "invoice_allocations_invoice_id_idx" ON "invoice_allocations"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_allocations_cr_id_idx" ON "invoice_allocations"("cr_id");

-- CreateIndex
CREATE INDEX "invoice_allocations_project_id_idx" ON "invoice_allocations"("project_id");

-- CreateIndex
CREATE INDEX "timesheet_periods_organisation_id_idx" ON "timesheet_periods"("organisation_id");

-- CreateIndex
CREATE INDEX "timesheet_periods_user_id_idx" ON "timesheet_periods"("user_id");

-- CreateIndex
CREATE INDEX "approvals_organisation_id_idx" ON "approvals"("organisation_id");

-- CreateIndex
CREATE INDEX "approvals_timesheet_period_id_idx" ON "approvals"("timesheet_period_id");

-- CreateIndex
CREATE INDEX "approvals_approver_id_idx" ON "approvals"("approver_id");

-- CreateIndex
CREATE INDEX "expenses_organisation_id_idx" ON "expenses"("organisation_id");

-- CreateIndex
CREATE INDEX "expenses_user_id_idx" ON "expenses"("user_id");

-- CreateIndex
CREATE INDEX "expenses_project_id_idx" ON "expenses"("project_id");

-- CreateIndex
CREATE INDEX "expenses_client_id_idx" ON "expenses"("client_id");

-- CreateIndex
CREATE INDEX "expenses_cr_id_idx" ON "expenses"("cr_id");

-- CreateIndex
CREATE INDEX "time_off_policies_organisation_id_idx" ON "time_off_policies"("organisation_id");

-- CreateIndex
CREATE INDEX "time_off_requests_organisation_id_idx" ON "time_off_requests"("organisation_id");

-- CreateIndex
CREATE INDEX "time_off_requests_user_id_idx" ON "time_off_requests"("user_id");

-- CreateIndex
CREATE INDEX "time_off_requests_policy_id_idx" ON "time_off_requests"("policy_id");

-- CreateIndex
CREATE INDEX "time_off_requests_approver_id_idx" ON "time_off_requests"("approver_id");

-- CreateIndex
CREATE INDEX "forecasts_organisation_id_idx" ON "forecasts"("organisation_id");

-- CreateIndex
CREATE INDEX "forecasts_cr_id_idx" ON "forecasts"("cr_id");

-- CreateIndex
CREATE INDEX "forecasts_project_id_idx" ON "forecasts"("project_id");

-- CreateIndex
CREATE INDEX "alert_rules_organisation_id_idx" ON "alert_rules"("organisation_id");

-- CreateIndex
CREATE INDEX "notifications_organisation_id_idx" ON "notifications"("organisation_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_alert_rule_id_idx" ON "notifications"("alert_rule_id");

-- CreateIndex
CREATE INDEX "risk_flags_organisation_id_idx" ON "risk_flags"("organisation_id");

-- CreateIndex
CREATE INDEX "risk_flags_organisation_id_entity_type_entity_id_idx" ON "risk_flags"("organisation_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organisation_id_key" ON "subscriptions"("organisation_id");

-- CreateIndex
CREATE INDEX "entitlements_organisation_id_idx" ON "entitlements"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_organisation_id_feature_key_key" ON "entitlements"("organisation_id", "feature_key");

-- CreateIndex
CREATE INDEX "custom_field_defs_organisation_id_idx" ON "custom_field_defs"("organisation_id");

-- CreateIndex
CREATE INDEX "custom_field_values_organisation_id_entity_type_entity_id_idx" ON "custom_field_values"("organisation_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "custom_field_values_field_def_id_idx" ON "custom_field_values"("field_def_id");

-- CreateIndex
CREATE INDEX "configurable_work_types_organisation_id_idx" ON "configurable_work_types"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "branding_organisation_id_key" ON "branding"("organisation_id");

-- CreateIndex
CREATE INDEX "api_keys_organisation_id_idx" ON "api_keys"("organisation_id");

-- CreateIndex
CREATE INDEX "api_keys_created_by_idx" ON "api_keys"("created_by");

-- CreateIndex
CREATE INDEX "webhooks_organisation_id_idx" ON "webhooks"("organisation_id");

-- CreateIndex
CREATE INDEX "contractor_profiles_organisation_id_idx" ON "contractor_profiles"("organisation_id");

-- CreateIndex
CREATE INDEX "contractor_profiles_user_id_idx" ON "contractor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_organisation_id_idx" ON "supplier_invoices"("organisation_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_contractor_profile_id_idx" ON "supplier_invoices"("contractor_profile_id");

-- CreateIndex
CREATE INDEX "portal_access_organisation_id_idx" ON "portal_access"("organisation_id");

-- CreateIndex
CREATE INDEX "portal_access_membership_id_idx" ON "portal_access"("membership_id");

-- CreateIndex
CREATE INDEX "portal_access_client_id_idx" ON "portal_access"("client_id");

-- CreateIndex
CREATE INDEX "workflow_rules_organisation_id_idx" ON "workflow_rules"("organisation_id");

-- CreateIndex
CREATE INDEX "ai_interactions_organisation_id_idx" ON "ai_interactions"("organisation_id");

-- CreateIndex
CREATE INDEX "ai_interactions_user_id_idx" ON "ai_interactions"("user_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_lines" ADD CONSTRAINT "time_lines_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_lines" ADD CONSTRAINT "time_lines_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_lines" ADD CONSTRAINT "time_lines_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_lines" ADD CONSTRAINT "time_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_lines" ADD CONSTRAINT "time_lines_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_lines" ADD CONSTRAINT "time_lines_cr_id_fkey" FOREIGN KEY ("cr_id") REFERENCES "change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_lines" ADD CONSTRAINT "time_lines_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_line_tags" ADD CONSTRAINT "time_line_tags_time_line_id_fkey" FOREIGN KEY ("time_line_id") REFERENCES "time_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_line_tags" ADD CONSTRAINT "time_line_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_calendar" ADD CONSTRAINT "working_calendar_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_calendar" ADD CONSTRAINT "working_calendar_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cr_consumption" ADD CONSTRAINT "cr_consumption_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cr_consumption" ADD CONSTRAINT "cr_consumption_cr_id_fkey" FOREIGN KEY ("cr_id") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overrun_attempts" ADD CONSTRAINT "overrun_attempts_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overrun_attempts" ADD CONSTRAINT "overrun_attempts_cr_id_fkey" FOREIGN KEY ("cr_id") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overrun_attempts" ADD CONSTRAINT "overrun_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_allocations" ADD CONSTRAINT "invoice_allocations_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_allocations" ADD CONSTRAINT "invoice_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_allocations" ADD CONSTRAINT "invoice_allocations_cr_id_fkey" FOREIGN KEY ("cr_id") REFERENCES "change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_allocations" ADD CONSTRAINT "invoice_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_periods" ADD CONSTRAINT "timesheet_periods_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_periods" ADD CONSTRAINT "timesheet_periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_timesheet_period_id_fkey" FOREIGN KEY ("timesheet_period_id") REFERENCES "timesheet_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cr_id_fkey" FOREIGN KEY ("cr_id") REFERENCES "change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_policies" ADD CONSTRAINT "time_off_policies_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "time_off_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_cr_id_fkey" FOREIGN KEY ("cr_id") REFERENCES "change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_defs" ADD CONSTRAINT "custom_field_defs_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_def_id_fkey" FOREIGN KEY ("field_def_id") REFERENCES "custom_field_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configurable_work_types" ADD CONSTRAINT "configurable_work_types_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branding" ADD CONSTRAINT "branding_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_profiles" ADD CONSTRAINT "contractor_profiles_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_profiles" ADD CONSTRAINT "contractor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_contractor_profile_id_fkey" FOREIGN KEY ("contractor_profile_id") REFERENCES "contractor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
