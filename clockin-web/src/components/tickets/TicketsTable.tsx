'use client';

import { Button } from '@/components/ui/Button';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { Client, Project, Ticket } from '@/types/api';
import {
  TICKET_PRIORITY_CODE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  type TicketPriority,
  type TicketPriorityCode,
  type TicketStatus,
  type TicketType,
} from '@/types/api';

type TicketsTableProps = {
  tickets: Ticket[];
  clientsById: Map<string, Client>;
  projectsById: Map<string, Project>;
  canEdit: boolean;
  /** When true (project detail), omit redundant client/project columns. */
  hideClientColumn?: boolean;
  hideProjectColumn?: boolean;
  /** Open ticket detail page. */
  onOpen?: (ticket: Ticket) => void;
};

function typeLabel(value: string) {
  return TICKET_TYPE_LABELS[value as TicketType] ?? value.replace(/_/g, ' ');
}

function statusLabel(value: string) {
  return (
    TICKET_STATUS_LABELS[value as TicketStatus] ?? value.replace(/_/g, ' ')
  );
}

export function TicketsTable({
  tickets,
  clientsById,
  projectsById,
  canEdit: _canEdit,
  hideClientColumn = false,
  hideProjectColumn = false,
  onOpen,
}: TicketsTableProps) {
  const columns: DataTableColumn<Ticket>[] = [
    {
      id: 'reference',
      header: 'Ticket',
      cell: (row) => (
        <div className="min-w-0">
          {onOpen ? (
            <button
              type="button"
              className="block min-w-0 text-left"
              onClick={() => onOpen(row)}
            >
              <p className="truncate font-medium text-ink hover:text-coral">
                {row.reference}
              </p>
              <p className="truncate text-xs text-slate">
                {row.title || typeLabel(row.ticketType)}
              </p>
            </button>
          ) : (
            <>
              <p className="truncate font-medium text-ink">{row.reference}</p>
              <p className="truncate text-xs text-slate">
                {row.title || typeLabel(row.ticketType)}
              </p>
            </>
          )}
        </div>
      ),
    },
  ];

  if (!hideClientColumn) {
    columns.push({
      id: 'client',
      header: 'Client',
      cell: (row) => (
        <span className="truncate text-slate">
          {clientsById.get(row.clientId)?.name || '—'}
        </span>
      ),
    });
  }

  if (!hideProjectColumn) {
    columns.push({
      id: 'project',
      header: 'Project',
      cell: (row) => (
        <span className="truncate text-slate">
          {row.projectId
            ? projectsById.get(row.projectId)?.name || '—'
            : '—'}
        </span>
      ),
    });
  }

  columns.push(
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <span className="text-sm text-slate">{typeLabel(row.ticketType)}</span>
      ),
    },
    {
      id: 'agent',
      header: 'Agent',
      cell: (row) => (
        <span className="truncate text-sm text-slate">
          {row.agentName?.trim() || '—'}
        </span>
      ),
    },
    {
      id: 'group',
      header: 'Group',
      cell: (row) => (
        <span className="truncate text-sm text-slate">
          {row.department?.name || '—'}
        </span>
      ),
    },
    {
      id: 'logged',
      header: 'Approved',
      cell: (row) => (
        <span
          className="tabular-nums text-sm text-navy"
          title="Approved time linked to this ticket only"
        >
          {formatHoursMinutes(row.loggedMinutes ?? 0)}
        </span>
      ),
    },
    {
      id: 'ticketPriority',
      header: 'P',
      cell: (row) =>
        row.ticketPriority ? (
          <span className="text-sm font-medium tabular-nums text-navy">
            {TICKET_PRIORITY_CODE_LABELS[
              row.ticketPriority as TicketPriorityCode
            ] ?? row.ticketPriority.toUpperCase()}
          </span>
        ) : (
          <span className="text-slate">—</span>
        ),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (row) =>
        row.priority ? (
          <span className="text-sm text-navy">
            {TICKET_PRIORITY_LABELS[row.priority as TicketPriority] ??
              row.priority}
          </span>
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
          {statusLabel(row.status)}
        </span>
      ),
    },
  );

  if (onOpen) {
    columns.push({
      id: 'actions',
      header: '',
      headerClassName: 'w-[1%]',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpen(row)}
          >
            Open
          </Button>
        </div>
      ),
    });
  }

  return (
    <DataTable columns={columns} rows={tickets} rowKey={(row) => row.id} />
  );
}
