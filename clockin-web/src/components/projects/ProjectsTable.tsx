'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import type { Client, MemberSummary, Project } from '@/types/api';

type ProjectsTableProps = {
  projects: Project[];
  clientsById: Map<string, Client>;
  membersById: Map<string, MemberSummary>;
  canEdit: boolean;
  /** FINAL FIX 8 — member-only: hide client/budget. Managers keep commercial columns. */
  memberView?: boolean;
  /** Name links to project detail (assigned tasks) */
  showOpen?: boolean;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
};

function statusColor(status: string) {
  if (status === 'active') return 'bg-success';
  if (status === 'planned') return 'bg-coral';
  if (status === 'on_hold') return 'bg-warning';
  return 'bg-slate';
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function formatBudget(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function managerLabel(
  row: Project,
  membersById: Map<string, MemberSummary>,
) {
  const nested = row.owner?.user?.name || row.owner?.user?.email;
  if (nested) return nested;
  if (!row.ownerId) return null;
  const member = membersById.get(row.ownerId);
  return member?.user.name || member?.user.email || null;
}

export function ProjectsTable({
  projects,
  clientsById,
  membersById,
  canEdit,
  memberView = false,
  showOpen = false,
  onEdit,
  onArchive,
}: ProjectsTableProps) {
  const columns: DataTableColumn<Project>[] = [
    {
      id: 'name',
      header: 'Project',
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: row.color || '#ff494a' }}
          />
          <div className="min-w-0">
            {showOpen ? (
              <Link
                href={`/projects/${row.id}`}
                className="group block min-w-0 transition"
              >
                <span className="block truncate font-medium text-navy group-hover:text-coral group-hover:underline">
                  {row.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate">
                  {row.code || 'Project'}
                </span>
              </Link>
            ) : (
              <div className="min-w-0">
                <p className="truncate font-medium text-navy">{row.name}</p>
                <p className="truncate text-xs text-slate">{row.code || '—'}</p>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  if (!memberView) {
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

  columns.push({
    id: 'owner',
    header: 'Manager',
    cell: (row) => (
      <span className="truncate text-slate">
        {managerLabel(row, membersById) || '—'}
      </span>
    ),
  });

  if (!memberView) {
    columns.push({
      id: 'budget',
      header: 'Budget hrs',
      cell: (row) => (
        <span className="tabular-nums text-slate">
          {formatBudget(row.budgetHours)}
        </span>
      ),
    });
  }

  columns.push({
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <span className="inline-flex items-center gap-1.5 text-sm text-navy">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor(row.status)}`}
        />
        {statusLabel(row.status)}
      </span>
    ),
  });

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      headerClassName: 'w-[1%]',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(row)}
          >
            Edit
          </Button>
          {row.status !== 'archived' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={() => onArchive(row)}
            >
              Archive
            </Button>
          ) : null}
        </div>
      ),
    });
  }

  return (
    <DataTable columns={columns} rows={projects} rowKey={(row) => row.id} />
  );
}
