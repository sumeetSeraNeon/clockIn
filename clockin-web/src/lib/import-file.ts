import * as XLSX from 'xlsx';

export const IMPORT_MAX_ROWS = 2000;

export type ImportKind = 'clients' | 'projects' | 'tasks';

export const IMPORT_HEADERS: Record<ImportKind, string[]> = {
  clients: ['client name'],
  projects: ['client name', 'project name'],
  tasks: ['client name', 'project name', 'task name'],
};

export const IMPORT_TEMPLATE_FILENAME: Record<ImportKind, string> = {
  clients: 'clients-import-template.csv',
  projects: 'projects-import-template.csv',
  tasks: 'tasks-import-template.csv',
};

export type ParsedImportRow = {
  rowKey: string;
  clientName?: string;
  projectName?: string;
  taskName?: string;
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
      return String(value ?? '').trim();
    }
  }
  return '';
}

/** Download a CSV template with the exact headers for this import. */
export function downloadImportTemplate(kind: ImportKind): void {
  const headers = IMPORT_HEADERS[kind];
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
  const workbook = XLSX.read(buffer, { type: 'array' });
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
    return {
      ...base,
      clientName: cell(row, 'client name'),
      projectName: cell(row, 'project name'),
      taskName: cell(row, 'task name'),
    };
  });
}
