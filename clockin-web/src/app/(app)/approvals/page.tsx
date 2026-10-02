'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { formatHoursMinutes } from '@/lib/format-duration';
import { getErrorMessage } from '@/lib/get-error-message';
import { usePermissions } from '@/lib/use-permissions';
import type { TimesheetDayLine, TimesheetPendingItem } from '@/types/api';

type RejectTarget =
  | { kind: 'slice'; item: TimesheetPendingItem }
  | { kind: 'line'; sliceId: string; line: TimesheetDayLine };

type ApproveTarget =
  | { kind: 'all'; item: TimesheetPendingItem }
  | { kind: 'line'; sliceId: string; line: TimesheetDayLine };

function formatRange(start: string | null, end: string | null) {
  if (!start || !end) return 'Period';
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`;
}

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function lineStatusLabel(status: string | undefined) {
  if (!status || status === 'submitted') return 'Waiting';
  return status.replace(/_/g, ' ');
}

/**
 * Approvals — per-line and bulk approve/reject for project slices.
 */
export default function ApprovalsPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const canApprove = can('timesheet', 'approve');

  const [data, setData] = useState<TimesheetPendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [approveTarget, setApproveTarget] = useState<ApproveTarget | null>(
    null,
  );
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const reload = useCallback(async () => {
    if (!canApprove) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: TimesheetPendingItem[]; total: number }>(
        '/timesheets/pending',
      );
      setData(res.data ?? []);
    } catch (err) {
      setData([]);
      setError(getErrorMessage(err, 'Could not load pending approvals'));
    } finally {
      setLoading(false);
    }
  }, [canApprove]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleApproveAll(item: TimesheetPendingItem) {
    setActingKey(`slice:${item.id}`);
    try {
      await api(`/timesheets/${item.id}/approve`, { method: 'POST' });
      toast.success('All pending lines approved');
      setApproveTarget(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not approve'));
    } finally {
      setActingKey(null);
    }
  }

  async function handleApproveLine(sliceId: string, line: TimesheetDayLine) {
    setActingKey(`line:${line.lineId}`);
    try {
      await api(`/timesheets/${sliceId}/lines/${line.lineId}/approve`, {
        method: 'POST',
      });
      toast.success('Line approved');
      setApproveTarget(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not approve line'));
    } finally {
      setActingKey(null);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error('Enter a rejection reason (at least 3 characters)');
      return;
    }
    setRejecting(true);
    try {
      if (rejectTarget.kind === 'slice') {
        await api(`/timesheets/${rejectTarget.item.id}/reject`, {
          method: 'POST',
          body: { reason: trimmed },
        });
        toast.success('All pending lines rejected');
      } else {
        await api(
          `/timesheets/${rejectTarget.sliceId}/lines/${rejectTarget.line.lineId}/reject`,
          {
            method: 'POST',
            body: { reason: trimmed },
          },
        );
        toast.success('Line rejected');
      }
      setRejectTarget(null);
      setReason('');
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not reject'));
    } finally {
      setRejecting(false);
    }
  }

  if (!canApprove) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Approvals"
          description="Review submitted time lines and approve or reject them."
        />
        <EmptyState
          title="No access"
          description="You need timesheet:approve to review submissions."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Approvals"
        description="Approve or reject each time line, or decide all pending lines on a project at once."
        actions={
          <Button type="button" variant="secondary" onClick={() => void reload()}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <div className="space-y-3 border-t border-border/50 pt-6">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void reload()}
          >
            Try again
          </Button>
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="When someone submits a day or week, each project (or non-project time) appears here for your approval."
        />
      ) : (
        <ul className="divide-y divide-border/40 border-t border-border/50">
          {data.map((item) => {
            const label = item.user.name || item.user.email || item.userId;
            const busy = actingKey === `slice:${item.id}` || Boolean(actingKey);
            const kind =
              item.periodKind === 'day'
                ? 'Day'
                : item.periodKind === 'week'
                  ? 'Week'
                  : 'Period';
            const pendingLineCount = item.projects.reduce(
              (sum, p) =>
                sum +
                p.tasks.reduce(
                  (tSum, t) =>
                    tSum +
                    t.days.filter((d) => (d.status ?? 'submitted') === 'submitted')
                      .length,
                  0,
                ),
              0,
            );

            return (
              <li key={item.id} className="py-8 first:pt-6">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h2 className="text-xl font-semibold tracking-tight text-navy">
                        {label}
                      </h2>
                      <span className="text-sm text-slate">
                        {kind}
                        {item.projectName ? ` · ${item.projectName}` : ''}
                      </span>
                    </div>
                    <p className="text-sm text-slate">
                      {formatRange(item.periodStart, item.periodEnd)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-navy">
                      {formatHoursMinutes(item.durationMinutes)}
                    </p>
                    <p className="mt-0.5 text-sm text-slate">
                      {pendingLineCount} pending line
                      {pendingLineCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {item.projects.length === 0 ? (
                  <p className="mt-6 text-sm text-slate">
                    No time lines for this period.
                  </p>
                ) : (
                  <div className="mt-6 space-y-7">
                    {item.projects.map((project) => (
                      <section
                        key={project.projectId ?? project.projectName}
                      >
                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate">
                          {project.projectName}
                        </p>
                        <ul className="mt-3 space-y-5">
                          {project.tasks.map((task) => (
                            <li key={task.taskId ?? task.taskName}>
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-medium text-navy">
                                  {task.taskName}
                                </p>
                                <p className="text-sm tabular-nums text-slate">
                                  {formatHoursMinutes(task.durationMinutes)}
                                </p>
                              </div>
                              <ul className="mt-2 divide-y divide-border/30 rounded-lg bg-paper/50 px-3 sm:px-4">
                                {task.days.map((day) => {
                                  const status = day.status ?? 'submitted';
                                  const lineBusy =
                                    actingKey === `line:${day.lineId}`;
                                  const canDecide = status === 'submitted';
                                  return (
                                    <li
                                      key={day.lineId}
                                      className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                                    >
                                      <div className="min-w-0 text-sm">
                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                          <span className="font-medium text-navy">
                                            {formatDay(day.entryDate)}
                                          </span>
                                          <span className="text-slate">·</span>
                                          <span className="tabular-nums text-navy">
                                            {formatHoursMinutes(
                                              day.durationMinutes,
                                            )}
                                          </span>
                                          <span className="text-slate">·</span>
                                          <span
                                            className={
                                              status === 'approved'
                                                ? 'text-navy'
                                                : status === 'rejected'
                                                  ? 'text-danger'
                                                  : 'text-slate'
                                            }
                                          >
                                            {lineStatusLabel(status)}
                                          </span>
                                        </div>
                                        {day.description ? (
                                          <p className="mt-0.5 truncate text-slate">
                                            {day.description}
                                          </p>
                                        ) : null}
                                      </div>
                                      {canDecide ? (
                                        <div className="flex shrink-0 gap-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={Boolean(actingKey)}
                                            loading={lineBusy}
                                            onClick={() =>
                                              setApproveTarget({
                                                kind: 'line',
                                                sliceId: item.id,
                                                line: day,
                                              })
                                            }
                                          >
                                            Approve
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={Boolean(actingKey)}
                                            onClick={() => {
                                              setRejectTarget({
                                                kind: 'line',
                                                sliceId: item.id,
                                                line: day,
                                              });
                                              setReason('');
                                            }}
                                          >
                                            Reject
                                          </Button>
                                        </div>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || pendingLineCount === 0}
                    onClick={() => {
                      setRejectTarget({ kind: 'slice', item });
                      setReason('');
                    }}
                  >
                    Reject all
                  </Button>
                  <Button
                    type="button"
                    loading={actingKey === `slice:${item.id}`}
                    disabled={busy || pendingLineCount === 0}
                    onClick={() =>
                      setApproveTarget({ kind: 'all', item })
                    }
                  >
                    Approve all
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title={
          rejectTarget?.kind === 'line'
            ? 'Reject this time?'
            : 'Reject all pending lines?'
        }
        description={
          rejectTarget?.kind === 'line'
            ? 'This line goes back to the member so they can edit and resubmit. A reason is required.'
            : 'Every waiting line on this project slice will be rejected. The member can edit and resubmit. A reason is required.'
        }
        confirmLabel="Reject"
        danger
        loading={rejecting}
        onConfirm={() => void handleRejectConfirm()}
        onCancel={() => {
          if (!rejecting) setRejectTarget(null);
        }}
      >
        <label className="block text-sm text-ink">
          Reason
          <textarea
            className="mt-1.5 w-full rounded-md border border-border bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-coral/40"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What needs to change?"
            disabled={rejecting}
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={approveTarget?.kind === 'line'}
        title="Approve this time?"
        description={
          approveTarget?.kind === 'line'
            ? `Approve ${formatHoursMinutes(approveTarget.line.durationMinutes)} logged on ${formatDay(approveTarget.line.entryDate)}${approveTarget.line.description ? ` — “${approveTarget.line.description}”` : ''}. This locks the line for the member.`
            : ''
        }
        confirmLabel="Approve"
        loading={
          approveTarget?.kind === 'line'
            ? actingKey === `line:${approveTarget.line.lineId}`
            : false
        }
        onConfirm={() => {
          if (approveTarget?.kind === 'line') {
            void handleApproveLine(approveTarget.sliceId, approveTarget.line);
          }
        }}
        onCancel={() => setApproveTarget(null)}
      />

      <ConfirmDialog
        open={approveTarget?.kind === 'all'}
        title="Approve all pending lines?"
        description={
          approveTarget?.kind === 'all'
            ? `Approve every waiting line for ${approveTarget.item.user?.name || approveTarget.item.user?.email || 'this member'} (${formatRange(approveTarget.item.periodStart, approveTarget.item.periodEnd)}). Approved time becomes locked.`
            : ''
        }
        confirmLabel="Approve all"
        loading={
          approveTarget?.kind === 'all'
            ? actingKey === `slice:${approveTarget.item.id}`
            : false
        }
        onConfirm={() => {
          if (approveTarget?.kind === 'all') {
            void handleApproveAll(approveTarget.item);
          }
        }}
        onCancel={() => setApproveTarget(null)}
      />
    </div>
  );
}
