'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import type { MemberSummary, Project, Task } from '@/types/api';

type TasksTableProps = {
  tasks: Task[];
  projectsById: Map<string, Project>;
  membersById: Map<string, MemberSummary>;
  canEdit: boolean;
  /** FINAL FIX 3 — hide billable for members */
  showBillable?: boolean;
  /** When true, show Created instead of Assignee (member own-task list). */
  memberView?: boolean;
  /** Name / Track open `/tasks/:id` (project-style dashboard). */
  showOpen?: boolean;
  /** Hide Client · Project under the task name (e.g. already on a project page). */
  hideContext?: boolean;
  onEdit: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onArchive: (task: Task) => void;
};

function formatHours(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function personLabel(
  person:
    | { user?: { name?: string | null; email?: string } | null }
    | null
    | undefined,
) {
  return person?.user?.name || person?.user?.email || null;
}

function projectName(row: Task, projectsById: Map<string, Project>) {
  return (
    row.project?.name ||
    projectsById.get(row.projectId)?.name ||
    null
  );
}

function clientName(row: Task, projectsById: Map<string, Project>) {
  if (row.project?.client?.name) return row.project.client.name;
  const project = projectsById.get(row.projectId);
  return project?.client?.name || null;
}

function contextLabel(row: Task, projectsById: Map<string, Project>) {
  const client = clientName(row, projectsById);
  const project = projectName(row, projectsById);
  return [client, project].filter(Boolean).join(' · ');
}

function managerName(row: Task) {
  return personLabel(row.project?.owner) || null;
}

function assigneeName(
  row: Task,
  membersById: Map<string, MemberSummary>,
) {
  const fromNested = personLabel(row.assignee);
  if (fromNested) return fromNested;
  if (!row.assigneeId) return null;
  const member = membersById.get(row.assigneeId);
  return member?.user.name || member?.user.email || null;
}

export function TasksTable({
  tasks,
  projectsById,
  membersById,
  canEdit,
  showBillable = false,
  memberView = false,
  showOpen = false,
  hideContext = false,
  onEdit,
  onMarkDone,
  onArchive,
}: TasksTableProps) {
  const columns: DataTableColumn<Task>[] = [
    {
      id: 'name',
      header: 'Task',
      cell: (row) => {
        const context = hideContext
          ? null
          : contextLabel(row, projectsById);
        const billableLabel = showBillable
          ? row.billable
            ? 'Billable'
            : 'Non-billable'
          : null;

        const subtitle = [context, billableLabel].filter(Boolean).join(' · ');

        return (
          <div className="min-w-0">
            {showOpen ? (
              <Link
                href={`/tasks/${row.id}`}
                className="group block min-w-0 transition"
              >
                <span className="block truncate font-medium text-navy group-hover:text-coral group-hover:underline">
                  {row.name}
                </span>
                {subtitle ? (
                  <span className="mt-0.5 block truncate text-xs text-slate">
                    {subtitle}
                  </span>
                ) : null}
              </Link>
            ) : (
              <>
                <p className="truncate font-medium text-ink">{row.name}</p>
                {subtitle ? (
                  <p className="truncate text-xs text-slate">{subtitle}</p>
                ) : null}
              </>
            )}
          </div>
        );
      },
    },
    {
      id: 'manager',
      header: 'Manager',
      cell: (row) => (
        <span className="truncate text-slate">
          {managerName(row) || '—'}
        </span>
      ),
    },
    {
      id: 'assignee',
      header: 'Primary owner',
      cell: (row) => {
        const name = assigneeName(row, membersById);
        if (!row.assigneeId) {
          return <span className="text-slate">—</span>;
        }
        return (
          <span className="truncate text-slate">{name || '—'}</span>
        );
      },
    },
  ];

  if (memberView) {
    columns.push({
      id: 'created',
      header: 'Created',
      cell: (row) => (
        <span className="tabular-nums text-slate">
          {formatShortDate(row.createdAt)}
        </span>
      ),
    });
  }

  columns.push(
    {
      id: 'estimate',
      header: 'Est. hrs',
      cell: (row) => (
        <span className="tabular-nums text-slate">
          {formatHours(row.estimatedHours)}
        </span>
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
                : row.status === 'done'
                  ? 'bg-success'
                  : 'bg-slate'
            }`}
          />
          {row.status}
        </span>
      ),
    },
  );

  if (showOpen || canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      headerClassName: 'w-[1%]',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          {row.status === 'open' && showOpen ? (
            <Link
              href={`/tasks/${row.id}`}
              className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium text-navy transition hover:bg-muted/70 hover:text-coral"
            >
              Track
            </Link>
          ) : null}
          {canEdit && row.status === 'open' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMarkDone(row)}
            >
              Done
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(row)}
            >
              Edit
            </Button>
          ) : null}
          {canEdit && row.status !== 'archived' ? (
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
    <DataTable columns={columns} rows={tasks} rowKey={(row) => row.id} />
  );
}
