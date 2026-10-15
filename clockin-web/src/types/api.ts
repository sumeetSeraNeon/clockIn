export type MeUser = {
  id: string;
  email: string;
  name: string | null;
  /** IANA timezone from users.timezone (personal Settings). */
  timezone?: string | null;
  firebaseUid: string | null;
  authProvider: string;
  status: string;
};

export type UpdateMeInput = {
  name?: string;
  timezone?: string | null;
};

export type MeMembership = {
  id: string;
  organisationId: string;
  memberType: string;
  department: string | null;
  status: string;
};

export type MeRole = {
  id: string;
  name: string;
};

export type MePermission = {
  resource: string;
  action: string;
  scope?: string | null;
};

export type MeOrganisation = {
  id: string;
  name: string;
  code: string | null;
  currency?: string | null;
};

/** Response shape of GET /api/me */
export type MeResponse = {
  user: MeUser;
  membership: MeMembership;
  organisation: MeOrganisation | null;
  roles: MeRole[];
  /** FIX 1: owner | admin | team_manager | project_manager | member */
  highestRole?: string | null;
  highestRoleLabel?: string | null;
  permissions: MePermission[];
  /** FIX 1: map of "resource:action" → "own" | "managed" | "all" */
  permissionScopes?: Record<string, string>;
  organisationId: string;
};

export type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
};

/** Response shape of GET /api/reports/summary */
export type ReportSummaryGroup = {
  key: string;
  label: string;
  clientId: string | null;
  projectId: string | null;
  taskId?: string | null;
  userId: string | null;
  durationMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  billableHours: number | string;
  nonBillableHours: number | string;
  revenue: string | null;
  /** STEP 3 — cost / margin only when commercial (rate:view) */
  cost?: string | null;
  margin?: string | null;
  marginPercent?: string | null;
  currency: string | null;
};

export type ReportSummaryResponse = {
  dateFrom: string;
  dateTo: string;
  groupBy: string;
  /** Admin/owner with rate:view — managers get hours-only team performance */
  commercial?: boolean;
  totals: {
    durationMinutes: number;
    billableMinutes: number;
    nonBillableMinutes: number;
    billableHours: number | string;
    nonBillableHours: number | string;
    revenue: string | null;
    cost?: string | null;
    margin?: string | null;
    marginPercent?: string | null;
    currency: string | null;
    unratedBillableMinutes?: number;
    unratedBillableHours?: number | string;
    uncostedMinutes?: number;
    uncostedHours?: number | string;
    /** FINAL FIX 7 — unapproved hours excluded from revenue */
    pendingDurationMinutes?: number;
    pendingBillableMinutes?: number;
    pendingDurationHours?: number | string;
    pendingBillableHours?: number | string;
  };
  groups: ReportSummaryGroup[];
  reconcile?: {
    groupsRevenue: string;
    groupsCost?: string;
    matchesTotals: boolean;
    lineCount: number;
  };
  revenuePolicy?: 'approved_only';
};

export type ReportGroupBy = 'project' | 'client' | 'user' | 'task' | 'manager';

export type ReportDetailedLine = {
  id: string;
  entryId: string;
  entryDate: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  taskId: string | null;
  taskName: string | null;
  projectId: string | null;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  durationMinutes: number;
  hours: number | string;
  billable: boolean;
  ticketType: string | null;
  area: string | null;
  description: string | null;
  billableRate: string | null;
  rateScope: string | null;
  revenue: string | null;
  currency: string | null;
  /** Billable line with no matching rate on that date */
  unrated?: boolean;
};

/** GET /reports/budget */
export type BudgetReportTaskRow = {
  taskId: string;
  taskName: string;
  status: string;
  estimatedHours: number | null;
  actualHours: number;
  actualMinutes: number;
  underEstimate: boolean;
  varianceHours: number | null;
};

export type BudgetReportProjectRow = {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  status: string;
  budgetHours: number | null;
  estimatedHours: number;
  actualHours: number;
  actualMinutes: number;
  remainingBudgetHours: number | null;
  overBudgetEstimate: boolean;
  overBudgetActual: boolean;
  /** STEP 3 — delivery health */
  startDate?: string | null;
  endDate?: string | null;
  budgetBurnPct?: number | null;
  timelineElapsedPct?: number | null;
  burnSignal?: 'on_track' | 'watch' | 'overrunning' | 'unknown';
  tasks: BudgetReportTaskRow[];
};

export type BudgetReportResponse = {
  dateFrom: string;
  dateTo: string;
  entryStatus: string;
  projects: BudgetReportProjectRow[];
};

/** GET /reports/utilisation — STEP 3 billable utilisation */
export type UtilisationPersonRow = {
  userId: string;
  userName: string | null;
  userEmail: string;
  trackedMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  trackedHours: string;
  billableHours: string;
  availableMinutes: number;
  availableHours: string;
  trackedUtilisationPct: number | null;
  billableUtilisationPct: number | null;
  calendarSource: 'user' | 'organisation' | 'weekday_fallback';
};

export type UtilisationReportResponse = {
  dateFrom: string;
  dateTo: string;
  policy: 'approved_only';
  availableHoursPolicy: string;
  people: UtilisationPersonRow[];
};

export type ApprovalsReportSliceRow = {
  sliceId: string;
  periodId: string;
  status: string;
  projectId: string | null;
  projectName: string;
  projectCode: string | null;
  managerMembershipId: string | null;
  managerName: string | null;
  memberUserId: string;
  memberName: string;
  memberEmail: string;
  periodStart: string | null;
  periodEnd: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
};

export type ApprovalsReportResponse = {
  dateFrom: string;
  dateTo: string;
  status: string;
  counts: {
    submitted: number;
    approved: number;
    rejected: number;
    total: number;
  };
  slices: ApprovalsReportSliceRow[];
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  pagination: PaginationMeta;
};

export type TimeLineSummary = {
  id: string;
  durationMinutes: number;
  billable: boolean;
  description: string | null;
  projectId: string | null;
  clientId: string | null;
};

export type TimeEntrySummary = {
  id: string;
  entryDate: string;
  userId: string;
  timeLines: TimeLineSummary[];
};

export type TimeLineArea = 'functional' | 'technical' | 'integration' | 'pm';
export type TimeLineTicketType = 'incident' | 'cr' | 'sr';
export type TimeEntrySource = 'timer' | 'manual' | 'api';

export type TimeLineTicketRef = {
  id: string;
  reference: string;
  status: string;
};

export type TimeLine = {
  id: string;
  organisationId: string;
  timeEntryId: string;
  taskId: string | null;
  projectId: string | null;
  clientId: string | null;
  ticketId: string | null;
  ticketType: string | null;
  /** Nested when API includes ticket (FIX 1). */
  ticket?: TimeLineTicketRef | null;
  area: string | null;
  crId: string | null;
  crNumber: string | null;
  durationMinutes: number;
  billable: boolean;
  description: string | null;
  isFirstLine: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimeEntry = {
  id: string;
  organisationId: string;
  userId: string;
  entryDate: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  timeLines: TimeLine[];
};

export type TimesheetPeriodStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'locked';

export type TimesheetApproval = {
  id: string;
  decision: string | null;
  reason: string | null;
  decidedAt: string | null;
  approverId: string | null;
  createdAt: string;
};

export type TimesheetPeriod = {
  id: string;
  organisationId: string;
  userId: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: TimesheetPeriodStatus | string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; name: string | null };
  approvals: TimesheetApproval[];
};

/** FINAL FIX 6 — pending approval payload with hours + breakdown */
export type TimesheetDayLine = {
  lineId: string;
  entryId: string;
  entryDate: string;
  /** ISO timestamptz from the parent time entry (clock range). */
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes: number;
  description: string | null;
  billable: boolean;
  /** draft | submitted | approved | rejected */
  status?: string;
  /** Linked ticket on the time line (FIX 1 — Approvals). */
  ticketId?: string | null;
  ticketReference?: string | null;
};

export type TimesheetTaskBreakdown = {
  taskId: string | null;
  taskName: string;
  durationMinutes: number;
  billableMinutes: number;
  descriptions: string[];
  days: TimesheetDayLine[];
};

export type TimesheetProjectBreakdown = {
  projectId: string | null;
  projectName: string;
  clientId?: string | null;
  clientName?: string | null;
  durationMinutes: number;
  billableMinutes: number;
  tasks: TimesheetTaskBreakdown[];
};

export type TimesheetPeriodKind = 'day' | 'week' | 'custom';

export type TimesheetPendingItem = TimesheetPeriod & {
  /** Parent timesheet period (billable routes use this). */
  periodId?: string;
  sliceId?: string;
  projectId?: string | null;
  projectName?: string;
  clientId?: string | null;
  clientName?: string | null;
  durationMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  entryCount: number;
  projects: TimesheetProjectBreakdown[];
  periodKind?: TimesheetPeriodKind;
  managerMembershipId?: string | null;
  managerName?: string | null;
};

/** Manager feedback FIX 2 — org-wide approvals log row (admin/owner). */
export type ApprovalsLogItem = {
  sliceId: string;
  periodId: string;
  status: 'submitted' | 'approved' | 'rejected' | string;
  projectId: string | null;
  projectName: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  approverMembershipId: string | null;
  approverName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  durationMinutes: number;
  submittedAt: string | null;
  decidedAt: string | null;
  decision: string | null;
  reason: string | null;
};

export type ApprovalsLogResponse = {
  data: ApprovalsLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type TimesheetMineResponse = {
  period: TimesheetPeriod | null;
  periodStart: string;
  periodEnd: string;
  entryCount: number;
  runningCount: number;
  durationMinutes: number;
  canSubmit: boolean;
  locked: boolean;
  /** Days in range already covered by another submitted/approved period */
  conflictDays?: string[];
};

export type TimeLineInput = {
  taskId?: string;
  projectId?: string;
  clientId?: string;
  ticketId?: string;
  ticketType?: TimeLineTicketType;
  area?: TimeLineArea;
  crId?: string;
  crNumber?: string;
  durationMinutes: number;
  billable?: boolean;
  description?: string;
};

export type CreateTimeEntryInput = {
  entryDate: string;
  source?: TimeEntrySource;
  startTime?: string;
  endTime?: string | null;
  line: TimeLineInput;
};

export type UpdateTimeEntryInput = {
  entryDate?: string;
  startTime?: string;
  endTime?: string | null;
};

export type UpdateTimeLineInput = {
  taskId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  ticketId?: string | null;
  ticketType?: TimeLineTicketType | null;
  area?: TimeLineArea | null;
  crId?: string | null;
  crNumber?: string | null;
  durationMinutes?: number;
  billable?: boolean;
  description?: string | null;
};

export type TaskSummary = {
  id: string;
  name: string;
  status: string;
  projectId: string;
  assigneeId: string | null;
  project?: { id: string; name: string } | null;
};

export type TaskStatus = 'open' | 'done' | 'archived';

export type TaskPerson = {
  id: string;
  user: { id: string; name: string | null; email: string };
};

export type Task = {
  id: string;
  organisationId: string;
  projectId: string;
  name: string;
  status: string;
  assigneeId: string | null;
  estimatedHours: string | number | null;
  billable: boolean;
  createdAt: string;
  updatedAt: string;
  /** Nested from API — members get context without /projects or /members */
  project?: {
    id: string;
    name: string;
    code?: string | null;
    ownerId?: string | null;
    owner?: TaskPerson | null;
  } | null;
  assignee?: TaskPerson | null;
};

export type CreateTaskInput = {
  projectId: string;
  name: string;
  status?: TaskStatus;
  assigneeId?: string;
  estimatedHours?: number;
  billable?: boolean;
};

export type UpdateTaskInput = {
  projectId?: string;
  name?: string;
  status?: TaskStatus;
  assigneeId?: string | null;
  estimatedHours?: number | null;
  billable?: boolean;
};

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketType = 'incident' | 'service_request';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

/** One time line linked to a ticket (detail only). */
export type TicketTimeEntry = {
  lineId: string;
  entryId: string;
  userId: string;
  userName: string;
  entryDate: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  taskName: string | null;
  description: string | null;
  status: string;
};

export type TicketMinutesByStatus = {
  submitted: number;
  approved: number;
};

export type Ticket = {
  id: string;
  organisationId: string;
  clientId: string;
  projectId: string | null;
  reference: string;
  ticketType: string;
  title: string | null;
  description: string | null;
  status: string;
  priority: string | null;
  raisedBy: string | null;
  openedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Approved minutes only (list + detail). */
  loggedMinutes?: number;
  /** Detail (GET /tickets/:id) — linked lines only. */
  minutesByStatus?: TicketMinutesByStatus;
  timeEntries?: TicketTimeEntry[];
};

export type CreateTicketInput = {
  clientId: string;
  projectId?: string;
  reference: string;
  ticketType: TicketType;
  title?: string;
  description?: string;
  priority?: TicketPriority;
  raisedBy?: string;
};

export type UpdateTicketInput = {
  clientId?: string;
  projectId?: string | null;
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority | null;
  raisedBy?: string | null;
};

/** Forward-only: open → in_progress → resolved → closed */
export const TICKET_NEXT_STATUS: Record<TicketStatus, TicketStatus | null> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
  closed: null,
};

export type ClientStatus = 'active' | 'inactive' | 'archived';

export type Client = {
  id: string;
  organisationId: string;
  name: string;
  code: string | null;
  currency: string | null;
  ownerId: string | null;
  status: string;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientInput = {
  name: string;
  code?: string;
  currency?: string;
  ownerId?: string;
  status?: ClientStatus;
  externalRef?: string;
};

export type UpdateClientInput = {
  name?: string;
  code?: string;
  currency?: string;
  ownerId?: string | null;
  status?: ClientStatus;
  externalRef?: string;
};

export type MemberSummary = {
  id: string;
  status: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
};

export type MemberType = 'staff' | 'contractor' | 'client_contact';
export type MembershipStatus = 'active' | 'deactivated' | 'pending';

export type OrgRole = {
  id: string;
  name: string;
  isSystem: boolean;
};

/** Full membership row from GET /members (includes nested user + roles). */
export type Member = {
  id: string;
  organisationId: string;
  userId: string;
  memberType: string;
  department: string | null;
  managerId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    status: string;
    authProvider: string | null;
    firebaseUid: string | null;
  };
  roles: OrgRole[];
  passwordResetLink?: string | null;
  /** Phase2 FIX6 — true when invite email was sent via SMTP. */
  inviteEmailSent?: boolean;
};

export type InviteMemberInput = {
  email: string;
  name?: string;
  memberType?: MemberType;
  department?: string;
  managerId?: string;
  roleIds?: string[];
};

export type RequestAccessInput = {
  name: string;
  organisationCode: string;
  department?: string;
};

export type RequestAccessResponse = {
  status: 'pending';
  organisation: { id: string; name: string; code: string | null };
  message: string;
};

export type UpdateMemberInput = {
  department?: string | null;
  managerId?: string | null;
  status?: MembershipStatus;
};

export type UpdateMemberRolesInput = {
  addRoleIds?: string[];
  removeRoleIds?: string[];
};

export type ProjectStatus =
  | 'planned'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'archived';

export type Project = {
  id: string;
  organisationId: string;
  clientId: string;
  name: string;
  code: string | null;
  ownerId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  budgetHours: string | number | null;
  budgetValue: string | number | null;
  billableByDefault: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  /** Nested from API — members get manager without /members */
  owner?: TaskPerson | null;
  /** FIX 3 — client currency for money display */
  client?: { id: string; name: string; currency: string | null } | null;
};

/** STEP 1 — person on a project team (GET /projects/:id/members) */
export type ProjectMember = {
  id: string;
  projectId: string;
  membershipId: string;
  roleOnProject: string;
  status: string;
  addedAt: string;
  membership: MemberSummary;
};

export type AddProjectMemberInput = {
  membershipId: string;
  roleOnProject?: 'contributor' | 'lead';
};

export type CreateProjectInput = {
  clientId: string;
  name: string;
  code?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
  budgetHours?: number;
  budgetValue?: number;
  billableByDefault?: boolean;
  color?: string;
};

export type UpdateProjectInput = {
  clientId?: string;
  name?: string;
  code?: string;
  ownerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: ProjectStatus;
  budgetHours?: number | null;
  budgetValue?: number | null;
  billableByDefault?: boolean;
  color?: string | null;
};

export type RateType = 'cost' | 'billable';
export type RateScope =
  | 'organisation'
  | 'client'
  | 'project'
  | 'user'
  | 'task'
  | 'project_user';

export type Rate = {
  id: string;
  organisationId: string;
  organisationName?: string;
  rateType: string;
  scope: string;
  clientId: string | null;
  projectId: string | null;
  userId: string | null;
  taskId: string | null;
  clientName?: string | null;
  projectName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  taskName?: string | null;
  appliesToLabel?: string;
  amount: string | number;
  currency: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  isCurrent?: boolean;
};

export type CreateRateInput = {
  rateType: RateType;
  scope: RateScope;
  clientId?: string;
  projectId?: string;
  userId?: string;
  taskId?: string;
  amount: number;
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

/** STEP 2 — paired cost + billable at project_user scope */
export type CreateRatePairInput = {
  projectId: string;
  userId: string;
  costAmount: number;
  billableAmount: number;
  currency?: string;
  effectiveFrom: string;
};

export type ProjectUserRatePair = {
  projectId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  costAmount: string | null;
  billableAmount: string | null;
  currency: string | null;
  marginAmount: string | null;
  marginPercent: string | null;
  costRateId: string | null;
  billableRateId: string | null;
  effectiveFrom: string | null;
};

export type CreateRatePairResult = {
  cost: Rate;
  billable: Rate;
  marginAmount: string;
  marginPercent: string | null;
  currency: string;
};

/** FIX 2 — CSV/Excel import preview + commit */
export type ImportRowStatus = 'create' | 'skip' | 'error' | 'excluded';

export type ImportSummary = {
  create: number;
  skip: number;
  error: number;
  excluded: number;
};

export type ImportClientLookup = { id: string; name: string };

export type ImportProjectLookup = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
};

export type ClientImportRow = {
  rowKey: string;
  clientName: string;
  excluded?: boolean;
  status: ImportRowStatus;
  reason?: string;
  matchedClientId?: string | null;
};

export type ProjectImportRow = {
  rowKey: string;
  clientName: string;
  projectName: string;
  clientId?: string | null;
  createClient?: boolean;
  excluded?: boolean;
  status: ImportRowStatus;
  reason?: string;
  matchedClientId?: string | null;
  matchedProjectId?: string | null;
};

export type TaskImportRow = {
  rowKey: string;
  taskName: string;
  projectName: string;
  clientName: string;
  clientId?: string | null;
  projectId?: string | null;
  createClient?: boolean;
  createProject?: boolean;
  excluded?: boolean;
  status: ImportRowStatus;
  reason?: string;
  matchedClientId?: string | null;
  matchedProjectId?: string | null;
  matchedTaskId?: string | null;
};

export type ImportPreviewResponse<T> = {
  rows: T[];
  summary: ImportSummary;
  lookups: {
    clients: ImportClientLookup[];
    projects?: ImportProjectLookup[];
  };
  canCreateClient?: boolean;
  canCreateProject?: boolean;
};

export type ImportCommitResult = {
  created: number;
  skipped: number;
  errors: number;
  message: string;
};
