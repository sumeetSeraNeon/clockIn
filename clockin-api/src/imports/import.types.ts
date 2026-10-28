/** Shared import preview / commit types (FIX 2). */

export const IMPORT_MAX_ROWS = 2000;

export type ImportRowStatus =
  | 'create'
  | 'update'
  | 'skip'
  | 'error'
  | 'excluded';

export type ImportSummary = {
  create: number;
  update: number;
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

export type ClientImportRowInput = {
  rowKey: string;
  clientName: string;
  excluded?: boolean;
};

export type ClientImportRowResult = ClientImportRowInput & {
  status: ImportRowStatus;
  reason?: string;
  matchedClientId?: string | null;
};

export type ProjectImportRowInput = {
  rowKey: string;
  clientName: string;
  projectName: string;
  /** Map unmatched/mistyped client name to an existing client. */
  clientId?: string | null;
  /** Create the client when name is new (requires client:edit). */
  createClient?: boolean;
  excluded?: boolean;
};

export type ProjectImportRowResult = ProjectImportRowInput & {
  status: ImportRowStatus;
  reason?: string;
  matchedClientId?: string | null;
  matchedProjectId?: string | null;
};

export type TaskImportRowInput = {
  rowKey: string;
  taskName: string;
  projectName: string;
  clientName: string;
  clientId?: string | null;
  projectId?: string | null;
  createClient?: boolean;
  createProject?: boolean;
  excluded?: boolean;
};

export type TaskImportRowResult = TaskImportRowInput & {
  status: ImportRowStatus;
  reason?: string;
  matchedClientId?: string | null;
  matchedProjectId?: string | null;
  matchedTaskId?: string | null;
};

export type TicketImportRowInput = {
  rowKey: string;
  clientName: string;
  reference: string;
  title: string;
  status: string;
  priority?: string | null;
  ticketType: string;
  agentName?: string | null;
  groupName?: string | null;
  openedAt?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  initialResponseAt?: string | null;
  firstResponseDuration?: string | null;
  resolutionDuration?: string | null;
  tags?: string | null;
  internalAgentName?: string | null;
  ticketPriority?: string | null;
  workstream?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  /** Always text — never a float from Excel. */
  contactExternalId?: string | null;
  source?: string | null;
  /** Override client match when preview picks a different client. */
  clientId?: string | null;
  excluded?: boolean;
};

export type TicketImportRowResult = TicketImportRowInput & {
  status: ImportRowStatus;
  reason?: string;
  matchedClientId?: string | null;
  matchedTicketId?: string | null;
  matchedDepartmentId?: string | null;
  parsed?: {
    ticketType: string;
    status: string;
    priority: string | null;
    ticketPriority: string | null;
    openedAt: string | null;
    dueAt: string | null;
    resolvedAt: string | null;
    closedAt: string | null;
    initialResponseAt: string | null;
    firstResponseSeconds: number | null;
    resolutionSeconds: number | null;
    internalAgentName: string | null;
  };
};

export type ImportCommitResult = {
  created: number;
  updated?: number;
  skipped: number;
  errors: number;
  message: string;
};

export function emptySummary(): ImportSummary {
  return { create: 0, update: 0, skip: 0, error: 0, excluded: 0 };
}

export function summarizeRows(
  rows: { status: ImportRowStatus }[],
): ImportSummary {
  const summary = emptySummary();
  for (const row of rows) {
    summary[row.status] += 1;
  }
  return summary;
}

export function normName(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function nameKey(value: string | null | undefined): string {
  return normName(value).toLowerCase();
}
