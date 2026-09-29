'use client';

import { Button } from '@/components/ui/Button';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import type { Client, MemberSummary } from '@/types/api';

type ClientsTableProps = {
  clients: Client[];
  membersById: Map<string, MemberSummary>;
  canEdit: boolean;
  onEdit: (client: Client) => void;
  onArchive: (client: Client) => void;
};

export function ClientsTable({
  clients,
  membersById,
  canEdit,
  onEdit,
  onArchive,
}: ClientsTableProps) {
  const columns: DataTableColumn<Client>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.name}</p>
          {row.externalRef ? (
            <p className="truncate text-xs text-slate">{row.externalRef}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'code',
      header: 'Code',
      cell: (row) => (
        <span className="tabular-nums text-slate">{row.code || '—'}</span>
      ),
    },
    {
      id: 'currency',
      header: 'Currency',
      cell: (row) => (
        <span className="tabular-nums text-slate">{row.currency || '—'}</span>
      ),
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: (row) => {
        if (!row.ownerId) return <span className="text-slate">—</span>;
        const member = membersById.get(row.ownerId);
        return (
          <span className="truncate text-slate">
            {member?.user.name || member?.user.email || 'Assigned'}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-navy">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              row.status === 'active'
                ? 'bg-success'
                : row.status === 'archived'
                  ? 'bg-slate'
                  : 'bg-warning'
            }`}
          />
          {row.status}
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
      cell: (row) => (
        <div className="flex justify-end gap-2">
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
    <DataTable columns={columns} rows={clients} rowKey={(row) => row.id} />
  );
}
