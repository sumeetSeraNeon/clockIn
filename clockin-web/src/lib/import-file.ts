import * as XLSX from 'xlsx';

export const IMPORT_MAX_ROWS = 2000;

export type ImportKind = 'clients' | 'projects' | 'tasks' | 'tickets';

export const IMPORT_HEADERS: Record<ImportKind, string[]> = {
  clients: ['client name'],
  projects: ['client name', 'project name'],
  tasks: ['client name', 'project name', 'task name'],
  tickets: ['ticket id', 'subject', 'status', 'type'],
};

export const IMPORT_TEMPLATE_FILENAME: Record<ImportKind, string> = {
  clients: 'clients-import-template.csv',
  projects: 'projects-import-template.csv',
  tasks: 'tasks-import-template.csv',
  tickets: 'tickets-import-template.csv',
};

export type ParsedImportRow = {
  rowKey: string;
  clientName?: string;
  projectName?: string;
  taskName?: string;
  /** Freshdesk ticket fields */
  reference?: string;
  title?: string;
  ticketStatus?: string;
  priority?: string;
  ticketType?: string;
  agentName?: string;
  groupName?: string;
  openedAt?: string;
  dueAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  initialResponseAt?: string;
  firstResponseDuration?: string;
  resolutionDuration?: string;
  tags?: string;
  internalAgentName?: string;
  ticketPriority?: string;
  workstream?: string;
  contactName?: string;
  contactEmail?: string;
  contactExternalId?: string;
  source?: string;
};

function normHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cell(row: Record<string, unknown>, header: string): string {
  const target = normHeader(header);
  for (const [key, value] of Object.entries(row)) {
    if (normHeader(key) === target) {
      if (value === null || value === undefined) return '';
      // Keep large ids as text (avoid scientific notation from Excel numbers).
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (
          target === 'contact internal id' ||
          target === 'ticket id' ||
          !Number.isInteger(value)
        ) {
          return value.toLocaleString('en-GB', {
            useGrouping: false,
            maximumFractionDigits: 0,
          });
        }
        return String(value);
      }
      return String(value).trim();
    }
  }
  return '';
}

/** Download a CSV template with the exact headers for this import. */
export function downloadImportTemplate(kind: ImportKind): void {
  const headers =
    kind === 'tickets'
      ? [
          'Client',
          'Ticket ID',
          'Subject',
          'Status',
          'Priority',
          'Source',
          'Type',
          'Agent',
          'Group',
          'Created time',
          'Due by Time',
          'Resolved time',
          'Closed time',
          'Initial response time',
          'First response time (in hrs)',
          'Resolution time (in hrs)',
          'Tags',
          'Internal agent',
          'Ticket Priority',
          'Workstream',
          'Full name',
          'Contact ID',
          'Contact Internal ID',
        ]
      : IMPORT_HEADERS[kind];
  const csv = `${headers.join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = IMPORT_TEMPLATE_FILENAME[kind];
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV or Excel (.xlsx) into normalised row objects.
 * Throws a user-facing Error on bad headers / empty / oversize files.
 */
export async function parseImportFile(
  kind: ImportKind,
  file: File,
): Promise<ParsedImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The file has no sheets');
  }
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (!raw.length) {
    throw new Error('The file has no data rows');
  }
  if (raw.length > IMPORT_MAX_ROWS) {
    throw new Error(`Import is limited to ${IMPORT_MAX_ROWS} rows`);
  }

  const required = IMPORT_HEADERS[kind];
  const first = raw[0];
  const present = new Set(Object.keys(first).map(normHeader));
  const missing = required.filter((h) => !present.has(normHeader(h)));
  if (missing.length) {
    throw new Error(
      `Missing column(s): ${missing.join(', ')}. Expected: ${required.join(', ')}`,
    );
  }

  return raw.map((row, index) => {
    const base: ParsedImportRow = { rowKey: `r-${index}` };
    if (kind === 'clients') {
      return { ...base, clientName: cell(row, 'client name') };
    }
    if (kind === 'projects') {
      return {
        ...base,
        clientName: cell(row, 'client name'),
        projectName: cell(row, 'project name'),
      };
    }
    if (kind === 'tasks') {
      return {
        ...base,
        clientName: cell(row, 'client name'),
        projectName: cell(row, 'project name'),
        taskName: cell(row, 'task name'),
      };
    }

    const clientFromCol = cell(row, 'client');
    const tags = cell(row, 'tags');
    return {
      ...base,
      clientName: clientFromCol || tags,
      reference: cell(row, 'ticket id'),
      title: cell(row, 'subject'),
      ticketStatus: cell(row, 'status'),
      priority: cell(row, 'priority'),
      ticketType: cell(row, 'type'),
      agentName: cell(row, 'agent'),
      groupName: cell(row, 'group'),
      openedAt: cell(row, 'created time'),
      dueAt: cell(row, 'due by time'),
      resolvedAt: cell(row, 'resolved time'),
      closedAt: cell(row, 'closed time'),
      initialResponseAt: cell(row, 'initial response time'),
      firstResponseDuration: cell(row, 'first response time (in hrs)'),
      resolutionDuration: cell(row, 'resolution time (in hrs)'),
      tags,
      internalAgentName: cell(row, 'internal agent'),
      ticketPriority: cell(row, 'ticket priority'),
      workstream: cell(row, 'workstream'),
      contactName: cell(row, 'full name'),
      contactEmail: cell(row, 'contact id'),
      contactExternalId: cell(row, 'contact internal id'),
      source: cell(row, 'source'),
    };
  });
}
