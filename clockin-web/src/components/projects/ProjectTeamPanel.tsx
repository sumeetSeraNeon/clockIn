'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/common/DataTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { RatePairForm } from '@/components/rates/RatePairForm';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/format-money';
import { getErrorMessage } from '@/lib/get-error-message';
import type {
  AddProjectMemberInput,
  CreateRatePairInput,
  CreateRatePairResult,
  MemberSummary,
  Paginated,
  Project,
  ProjectMember,
  ProjectUserRatePair,
} from '@/types/api';

type ProjectTeamPanelProps = {
  projectId: string;
  projectOwnerId: string | null;
  projectName?: string;
  clientId?: string;
  clientCurrency?: string | null;
  canEdit: boolean;
  canViewOrgMembers: boolean;
  /** rate:view (admin/owner). Cost stays hidden without this. */
  canViewRates?: boolean;
  /** rate:edit */
  canEditRates?: boolean;
  orgCurrency?: string;
  /** FIX 4 — notify parent so task assignee lists stay in sync */
  onTeamChange?: () => void;
};

/**
 * STEP 1 — project Team; STEP 2 — cost/bill/margin when rate:view.
 * FIX 4 — compact table instead of stacked cards.
 */
export function ProjectTeamPanel({
  projectId,
  projectOwnerId,
  projectName,
  clientCurrency = null,
  canEdit,
  canViewOrgMembers,
  canViewRates = false,
  canEditRates = false,
  orgCurrency = 'GBP',
  onTeamChange,
}: ProjectTeamPanelProps) {
  const toast = useToast();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<MemberSummary[]>([]);
  const [ratePairs, setRatePairs] = useState<ProjectUserRatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [rateTarget, setRateTarget] = useState<ProjectMember | null>(null);
  const [rateSubmitting, setRateSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<ProjectMember[]>(`/projects/${projectId}/members`);
      setMembers(list ?? []);
    } catch {
      setMembers([]);
      toast.error('Could not load project team');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable enough; avoid reload loops
  }, [projectId]);

  const loadRates = useCallback(async () => {
    if (!canViewRates) {
      setRatePairs([]);
      return;
    }
    try {
      const pairs = await api<ProjectUserRatePair[]>(
        `/rates/project-user?projectId=${encodeURIComponent(projectId)}`,
      );
      setRatePairs(pairs ?? []);
    } catch {
      setRatePairs([]);
    }
  }, [canViewRates, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  useEffect(() => {
    if (!canEdit || !canViewOrgMembers) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<Paginated<MemberSummary>>(
          '/members?pageSize=100&status=active',
        );
        if (!cancelled) setOrgMembers(res.data ?? []);
      } catch {
        if (!cancelled) setOrgMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEdit, canViewOrgMembers]);

  const onTeamIds = useMemo(
    () => new Set(members.map((m) => m.membershipId)),
    [members],
  );

  const ratesByUserId = useMemo(() => {
    const map = new Map<string, ProjectUserRatePair>();
    for (const p of ratePairs) map.set(p.userId, p);
    return map;
  }, [ratePairs]);

  const addOptions = useMemo(
    () => orgMembers.filter((m) => !onTeamIds.has(m.id)),
    [orgMembers, onTeamIds],
  );

  const projectForForm = useMemo((): Project[] => {
    return [
      {
        id: projectId,
        name: projectName || 'This project',
      } as Project,
    ];
  }, [projectId, projectName]);

  async function handleAdd() {
    if (!addingId) return;
    setSubmitting(true);
    try {
      const body: AddProjectMemberInput = { membershipId: addingId };
      await api<ProjectMember>(`/projects/${projectId}/members`, {
        method: 'POST',
        body,
      });
      toast.success('Added to project team');
      setAddingId('');
      await load();
      await loadRates();
      onTeamChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add member'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!removing) return;
    setRemoveLoading(true);
    try {
      await api(`/projects/${projectId}/members/${removing.membershipId}`, {
        method: 'DELETE',
      });
      toast.success('Removed from project team');
      setRemoving(null);
      await load();
      await loadRates();
      onTeamChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not remove member'));
    } finally {
      setRemoveLoading(false);
    }
  }

  async function handleSaveRates(values: CreateRatePairInput) {
    setRateSubmitting(true);
    try {
      const res = await api<CreateRatePairResult>('/rates/pair', {
        method: 'POST',
        body: values,
      });
      const pct =
        res.marginPercent != null
          ? ` (${Number(res.marginPercent).toFixed(0)}%)`
          : '';
      toast.success(
        `Rates saved · margin ${formatMoney(res.marginAmount, res.currency)}/h${pct}`,
      );
      setRateTarget(null);
      await loadRates();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save rates'));
    } finally {
      setRateSubmitting(false);
    }
  }

  const rateTargetPair = rateTarget
    ? ratesByUserId.get(rateTarget.membership.user.id)
    : undefined;

  const showActions = canEditRates || canEdit;

  const columns = useMemo((): DataTableColumn<ProjectMember>[] => {
    const cols: DataTableColumn<ProjectMember>[] = [
      {
        id: 'person',
        header: 'Person',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {row.membership.user.name || row.membership.user.email}
            </p>
            <p className="truncate text-xs text-slate">
              {row.membership.user.email}
            </p>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        cell: (row) => {
          const isOwner = row.membershipId === projectOwnerId;
          return (
            <span className="capitalize text-slate">
              {row.roleOnProject}
              {isOwner ? ' · manager' : ''}
            </span>
          );
        },
      },
    ];

    if (canViewRates) {
      cols.push(
        {
          id: 'cost',
          header: 'Cost/h',
          cell: (row) => {
            const pair = ratesByUserId.get(row.membership.user.id);
            return (
              <span className="tabular-nums text-slate">
                {formatMoney(pair?.costAmount ?? null, pair?.currency ?? null)}
              </span>
            );
          },
        },
        {
          id: 'bill',
          header: 'Bill/h',
          cell: (row) => {
            const pair = ratesByUserId.get(row.membership.user.id);
            return (
              <span className="tabular-nums text-navy">
                {formatMoney(
                  pair?.billableAmount ?? null,
                  pair?.currency ?? null,
                )}
              </span>
            );
          },
        },
        {
          id: 'margin',
          header: 'Margin',
          cell: (row) => {
            const pair = ratesByUserId.get(row.membership.user.id);
            if (!pair?.marginAmount) {
              return <span className="text-slate">—</span>;
            }
            const pct =
              pair.marginPercent != null
                ? ` (${Number(pair.marginPercent).toFixed(0)}%)`
                : '';
            return (
              <span className="font-medium tabular-nums text-navy">
                {formatMoney(pair.marginAmount, pair.currency)}
                <span className="font-normal text-slate">{pct}</span>
              </span>
            );
          },
        },
      );
    }

    if (showActions) {
      cols.push({
        id: 'actions',
        header: '',
        headerClassName: 'w-px',
        cell: (row) => {
          const isOwner = row.membershipId === projectOwnerId;
          const pair = ratesByUserId.get(row.membership.user.id);
          const hasRates = Boolean(pair?.costAmount || pair?.billableAmount);
          return (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {canEditRates ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRateTarget(row)}
                >
                  {hasRates ? 'Edit rates' : 'Set rates'}
                </Button>
              ) : null}
              {canEdit && !isOwner ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => setRemoving(row)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          );
        },
      });
    }

    return cols;
  }, [
    canEdit,
    canEditRates,
    canViewRates,
    projectOwnerId,
    ratesByUserId,
    showActions,
  ]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">
          Team
        </h2>
        <p className="mt-0.5 text-sm text-slate">
          {canViewRates
            ? 'People on this project with cost / bill / margin per hour.'
            : 'People on this project. Assign tasks only to people listed here.'}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate">Loading team…</p>
      ) : members.length === 0 ? (
        <EmptyState
          title="No one on this project yet"
          description={
            canEdit
              ? 'Add people to the project team before assigning tasks.'
              : 'You are not listed on this project team yet.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={members}
          rowKey={(row) => row.id}
        />
      )}

      {canEdit && canViewOrgMembers ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-slate">
            Add person
            <Select
              value={addingId}
              onChange={(e) => setAddingId(e.target.value)}
              disabled={submitting || addOptions.length === 0}
            >
              <option value="">
                {addOptions.length === 0
                  ? 'Everyone eligible is already on the team'
                  : 'Select a person'}
              </option>
              {addOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.user.name || m.user.email}
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="button"
            onClick={() => void handleAdd()}
            loading={submitting}
            disabled={!addingId || submitting}
          >
            Add
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove from project?"
        description={
          removing
            ? `Remove ${removing.membership.user.name || removing.membership.user.email} from this project team? They must have no open/done tasks and no logged time on this project.`
            : ''
        }
        confirmLabel="Remove"
        danger
        loading={removeLoading}
        onConfirm={() => void handleRemove()}
        onCancel={() => {
          if (!removeLoading) setRemoving(null);
        }}
      />

      <Modal
        open={Boolean(rateTarget)}
        title="Set project rates"
        description="Cost and billable per hour for this person on this project."
        onClose={() => {
          if (!rateSubmitting) setRateTarget(null);
        }}
      >
        {rateTarget ? (
          <RatePairForm
            projects={projectForForm}
            projectMembers={members}
            defaultProjectId={projectId}
            defaultUserId={rateTarget.membership.user.id}
            orgCurrency={orgCurrency}
            displayCurrency={
              rateTargetPair?.currency || clientCurrency || orgCurrency
            }
            initialCost={rateTargetPair?.costAmount ?? ''}
            initialBillable={rateTargetPair?.billableAmount ?? ''}
            submitting={rateSubmitting}
            onSubmit={handleSaveRates}
            onCancel={() => setRateTarget(null)}
          />
        ) : null}
      </Modal>
    </section>
  );
}
