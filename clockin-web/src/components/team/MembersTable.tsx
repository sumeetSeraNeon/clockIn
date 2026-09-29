'use client';

import { Button } from '@/components/ui/Button';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import type { Member } from '@/types/api';

type MembersTableProps = {
  members: Member[];
  membersById: Map<string, Member>;
  canEdit: boolean;
  currentMembershipId: string | null;
  approvingId: string | null;
  onEdit: (member: Member) => void;
  onApprove: (member: Member) => void;
  onDeactivate: (member: Member) => void;
};

function statusColor(status: string) {
  if (status === 'active') return 'bg-success';
  if (status === 'pending' || status === 'invited') return 'bg-warning';
  if (status === 'deactivated') return 'bg-slate';
  return 'bg-slate';
}

function StatusLabel({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-navy">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor(status)}`}
      />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function label(value: string) {
  return value.replace(/_/g, ' ');
}

export function MembersTable({
  members,
  membersById,
  canEdit,
  currentMembershipId,
  approvingId,
  onEdit,
  onApprove,
  onDeactivate,
}: MembersTableProps) {
  const columns: DataTableColumn<Member>[] = [
    {
      id: 'person',
      header: 'Person',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">
            {row.user.name || row.user.email}
          </p>
          <p className="truncate text-xs text-slate">{row.user.email}</p>
        </div>
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: (row) =>
        row.roles.length === 0 ? (
          <span className="text-slate">—</span>
        ) : (
          <span className="text-sm text-navy">
            {row.roles.map((r) => r.name).join(', ')}
          </span>
        ),
    },
    {
      id: 'department',
      header: 'Department',
      cell: (row) => (
        <span className="truncate text-slate">{row.department || '—'}</span>
      ),
    },
    {
      id: 'manager',
      header: 'Manager',
      cell: (row) => {
        if (!row.managerId) return <span className="text-slate">—</span>;
        const manager = membersById.get(row.managerId);
        return (
          <span className="truncate text-slate">
            {manager?.user.name || manager?.user.email || 'Assigned'}
          </span>
        );
      },
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <span className="text-slate">{label(row.memberType)}</span>
      ),
    },
    {
      id: 'membership',
      header: 'Membership',
      cell: (row) => <StatusLabel status={row.status} />,
    },
    {
      id: 'account',
      header: 'Account',
      cell: (row) => <StatusLabel status={row.user.status} />,
    },
  ];

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      headerClassName: 'w-[1%]',
      className: 'text-right',
      cell: (row) => {
        const isSelf = row.id === currentMembershipId;
        const isPending = row.status === 'pending';
        const needsActivate =
          row.status === 'active' && row.user.status === 'invited';
        return (
          <div className="flex justify-end gap-1">
            {isPending || needsActivate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={approvingId === row.id}
                disabled={approvingId === row.id}
                onClick={() => onApprove(row)}
              >
                Approve
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
            {row.status !== 'deactivated' && !isSelf && !isPending ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger"
                onClick={() => onDeactivate(row)}
              >
                Deactivate
              </Button>
            ) : null}
          </div>
        );
      },
    });
  }

  return (
    <DataTable columns={columns} rows={members} rowKey={(row) => row.id} />
  );
}
