'use client';

import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import { isRateCurrent } from '@/lib/use-rates';
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

function formatAmount(amount: string | number, currency: string | null) {
  const n = typeof amount === 'number' ? amount : Number(amount);
  const formatted = Number.isFinite(n) ? n.toFixed(2) : String(amount);
  return currency ? `${formatted} ${currency}` : formatted;
}

export function RatesTable({ rates }: RatesTableProps) {
  const columns: DataTableColumn<Rate>[] = [
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <span className="text-sm capitalize text-navy">{row.rateType}</span>
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
          {formatAmount(row.amount, row.currency)}
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
      cell: (row) =>
        isRateCurrent(row) ? (
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
    <DataTable columns={columns} rows={rates} rowKey={(row) => row.id} />
  );
}
