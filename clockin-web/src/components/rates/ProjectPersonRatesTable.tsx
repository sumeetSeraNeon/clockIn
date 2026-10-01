'use client';

import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import type { ProjectPersonRateRow } from '@/lib/rate-pairs';

type ProjectPersonRatesTableProps = {
  rows: ProjectPersonRateRow[];
};

function money(amount: string | null, currency: string | null) {
  if (amount == null) return '—';
  const code = currency || 'GBP';
  const symbol =
    code === 'GBP' ? '£' : code === 'EUR' ? '€' : code === 'USD' ? '$' : '';
  return symbol ? `${symbol}${amount}` : `${amount} ${code}`;
}

function marginPctClass(pct: number | null): string {
  if (pct == null) return 'text-slate';
  if (pct < 0) return 'font-medium tabular-nums text-danger';
  if (pct < 20) return 'font-medium tabular-nums text-amber-700';
  return 'tabular-nums text-navy';
}

/**
 * FIX 1 — one row per project-person; Project and Person as separate columns.
 */
export function ProjectPersonRatesTable({
  rows,
}: ProjectPersonRatesTableProps) {
  const columns: DataTableColumn<ProjectPersonRateRow>[] = [
    {
      id: 'project',
      header: 'Project',
      cell: (row) => (
        <span className="truncate font-medium text-ink">{row.projectName}</span>
      ),
    },
    {
      id: 'person',
      header: 'Person',
      cell: (row) => (
        <span className="truncate text-slate">{row.personLabel}</span>
      ),
    },
    {
      id: 'cost',
      header: 'Cost/h',
      cell: (row) => (
        <span className="tabular-nums text-slate">
          {money(row.costAmount, row.currency)}
        </span>
      ),
    },
    {
      id: 'bill',
      header: 'Bill/h',
      cell: (row) => (
        <span className="tabular-nums text-navy">
          {money(row.billableAmount, row.currency)}
        </span>
      ),
    },
    {
      id: 'margin',
      header: 'Margin/h',
      cell: (row) => (
        <span className="font-medium tabular-nums text-navy">
          {money(row.marginAmount, row.currency)}
        </span>
      ),
    },
    {
      id: 'marginPct',
      header: 'Margin %',
      cell: (row) => (
        <span className={marginPctClass(row.marginPercent)}>
          {row.marginPercent != null
            ? `${row.marginPercent.toFixed(0)}%`
            : '—'}
        </span>
      ),
    },
    {
      id: 'from',
      header: 'From',
      cell: (row) => (
        <span className="tabular-nums text-slate">
          {row.effectiveFrom ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.isCurrent ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-navy">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
            Current
          </span>
        ) : (
          <span className="text-sm text-slate">History</span>
        ),
    },
  ];

  return (
    <DataTable columns={columns} rows={rows} rowKey={(row) => row.key} />
  );
}
