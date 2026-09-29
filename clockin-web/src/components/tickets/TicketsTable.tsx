'use client';

import { Button } from '@/components/ui/Button';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import type { Client, Project, Ticket, TicketStatus } from '@/types/api';
import { TICKET_NEXT_STATUS } from '@/types/api';

type TicketsTableProps = {
  tickets: Ticket[];
  clientsById: Map<string, Client>;
  projectsById: Map<string, Project>;
  canEdit: boolean;
  onEdit: (ticket: Ticket) => void;
  onAdvance: (ticket: Ticket) => void;
};

function label(value: string) {
  return value.replace(/_/g, ' ');
}

function advanceLabel(next: TicketStatus) {
  if (next === 'in_progress') return 'Start';
  if (next === 'resolved') return 'Resolve';
  if (next === 'closed') return 'Close';
  return 'Advance';
}

export function TicketsTable({
  tickets,
  clientsById,
  projectsById,
  canEdit,
  onEdit,
  onAdvance,
}: TicketsTableProps) {
  const columns: DataTableColumn<Ticket>[] = [
    {
      id: 'reference',
      header: 'Ticket',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.reference}</p>
          <p className="truncate text-xs text-slate">
            {row.title || label(row.ticketType)}
          </p>
        </div>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      cell: (row) => (
        <span className="truncate text-slate">
          {clientsById.get(row.clientId)?.name || '—'}
        </span>
      ),
    },
    {
      id: 'project',
      header: 'Project',
      cell: (row) => (
        <span className="truncate text-slate">
          {row.projectId
            ? projectsById.get(row.projectId)?.name || '—'
            : '—'}
        </span>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <span className="text-sm text-slate">{label(row.ticketType)}</span>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (row) =>
        row.priority ? (
          <span className="text-sm text-navy">{row.priority}</span>
        ) : (
          <span className="text-slate">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-navy">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              row.status === 'open'
                ? 'bg-coral'
                : row.status === 'resolved' || row.status === 'closed'
                  ? 'bg-success'
                  : 'bg-warning'
            }`}
          />
          {label(row.status)}
        </span>
      ),
    },
  ];

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      headerClassName: 'w-[1%]',
      className: 'text-right',
      cell: (row) => {
        const next =
          TICKET_NEXT_STATUS[(row.status as TicketStatus) || 'open'];
        return (
          <div className="flex justify-end gap-2">
            {next ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAdvance(row)}
              >
                {advanceLabel(next)}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(row)}
            >
              Edit
            </Button>
          </div>
        );
      },
    });
  }

  return (
    <DataTable columns={columns} rows={tickets} rowKey={(row) => row.id} />
  );
}
