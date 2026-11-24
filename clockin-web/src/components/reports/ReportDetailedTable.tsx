'use client';

import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import { formatDisplayDate } from '@/lib/date-range';
import { formatHoursMinutes } from '@/lib/format-duration';
import { formatMoney } from '@/lib/format-money';
import { rateScopeLabel } from '@/lib/rate-scope-label';
import type { ReportDetailedLine } from '@/types/api';

type ReportDetailedTableProps = {
  rows: ReportDetailedLine[];
  /** When false, hide revenue/rate columns (PM / no rate:view). */
  commercial?: boolean;
};

export function ReportDetailedTable({
  rows,
  commercial = true,
}: ReportDetailedTableProps) {
  const columns: DataTableColumn<ReportDetailedLine>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: (row) => (
        <span className="tabular-nums text-slate">
          {formatDisplayDate(String(row.entryDate))}
        </span>
      ),
    },
    {
      id: 'person',
      header: 'Person',
      cell: (row) => (
        <span className="truncate text-ink">
          {row.userName || row.userEmail}
        </span>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      cell: (row) => (
        <span className="truncate text-slate">{row.clientName || '—'}</span>
      ),
    },
    {
      id: 'project',
      header: 'Project',
      cell: (row) => (
        <span className="truncate text-slate">{row.projectName || '—'}</span>
      ),
    },
    {
      id: 'task',
      header: 'Task',
      cell: (row) => (
        <span className="truncate text-slate">{row.taskName || '—'}</span>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      cell: (row) => (
        <span className="tabular-nums text-ink">
          {formatHoursMinutes(row.durationMinutes)}
        </span>
      ),
    },
    {
      id: 'billable',
      header: 'Billable',
      cell: (row) =>
        row.billable ? (
          <span className="text-sm text-success">Yes</span>
        ) : (
          <span className="text-sm text-slate">No</span>
        ),
    },
  ];

  if (commercial) {
    columns.push(
      {
        id: 'revenue',
        header: 'Revenue',
        cell: (row) => (
          <span className="tabular-nums text-slate">
            {row.unrated ? (
              <span title="No billable rate on this date">Unrated</span>
            ) : (
              formatMoney(row.revenue, row.currency)
            )}
          </span>
        ),
      },
      {
        id: 'rate',
        header: 'Rate',
        cell: (row) => {
          if (!row.billableRate) {
            return <span className="text-xs text-slate">—</span>;
          }
          const scope = rateScopeLabel(row.rateScope);
          return (
            <span className="text-xs text-slate">
              <span className="tabular-nums text-ink">
                {row.billableRate}/h
              </span>
              {scope ? (
                <span className="text-slate"> · {scope}</span>
              ) : null}
            </span>
          );
        },
      },
    );
  }

  return (
    <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
  );
}
