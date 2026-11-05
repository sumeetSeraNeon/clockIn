'use client';

import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import { formatMoney } from '@/lib/format-money';
import { rateTiming } from '@/lib/use-rates';
import type { Rate } from '@/types/api';

type RatesTableProps = {
  rates: Rate[];
};

function label(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return value.slice(0, 10);
}

export function RatesTable({ rates }: RatesTableProps) {
  const columns: DataTableColumn<Rate>[] = [
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <span className="capitalize text-navy">{row.rateType}</span>
      ),
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: (row) => (
        <span className="capitalize text-slate">{label(row.scope)}</span>
      ),
    },
    {
      id: 'applies',
      header: 'Applies to',
      cell: (row) => (
        <span className="truncate text-ink">
          {row.appliesToLabel ||
            row.organisationName ||
            'Organisation'}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (row) => (
        <span className="font-medium tabular-nums text-ink">
          {formatMoney(row.amount, row.currency)}
          <span className="font-normal text-slate">/h</span>
        </span>
      ),
    },
    {
      id: 'from',
      header: 'From',
      cell: (row) => (
        <span className="tabular-nums text-slate">
          {formatDate(row.effectiveFrom)}
        </span>
      ),
    },
    {
      id: 'to',
      header: 'To',
      cell: (row) => (
        <span className="tabular-nums text-slate">
          {formatDate(row.effectiveTo)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => {
        const timing = rateTiming(row.effectiveFrom, row.effectiveTo);
        if (timing === 'Current') {
          return (
            <span className="inline-flex items-center gap-1.5 text-sm text-navy">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
              Current
            </span>
          );
        }
        return <span className="text-sm text-slate">{timing}</span>;
      },
    },
  ];

  return (
    <DataTable columns={columns} rows={rates} rowKey={(row) => row.id} />
  );
}
