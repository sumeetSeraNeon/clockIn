/** Download an array of objects as a CSV file in the browser. */
export function downloadCsv(
  filename: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) {
    const blob = new Blob([''], { type: 'text/csv;charset=utf-8' });
    triggerDownload(filename, blob);
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((key) => csvEscape(row[key]))
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  triggerDownload(filename, blob);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
