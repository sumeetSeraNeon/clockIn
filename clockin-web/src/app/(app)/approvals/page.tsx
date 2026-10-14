'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchField } from '@/components/common/SearchField';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { IconChevronDown } from '@/components/ui/icons';
import { api, isAbortError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDayLineTimeLabel } from '@/lib/entry-display';
import { formatHoursMinutes } from '@/lib/format-duration';
import { getErrorMessage } from '@/lib/get-error-message';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePermissions } from '@/lib/use-permissions';
import type {
  ApprovalsLogItem,
  ApprovalsLogResponse,
  Member,
  Paginated,
  TimesheetDayLine,
  TimesheetPendingItem,
  TimesheetTaskBreakdown,
} from '@/types/api';

type RejectTarget =
  | { kind: 'slice'; item: TimesheetPendingItem }
  | { kind: 'line'; sliceId: string; line: TimesheetDayLine };

type ApproveTarget =
  | { kind: 'all'; item: TimesheetPendingItem }
  | { kind: 'line'; sliceId: string; line: TimesheetDayLine };

type MainTab = 'pending' | 'log';
type LogStatusFilter = 'all' | 'submitted' | 'approved' | 'rejected';

const TH =
  'px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy/55';
const TD = 'px-3 py-3 align-top text-sm';

function formatRange(start: string | null, end: string | null) {
  if (!start || !end) return 'Period unavailable';
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return 'Period unavailable';
  }
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

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusLabel(status: string) {
  if (status === 'submitted') return 'Submitted';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return status.replace(/_/g, ' ');
}

function isWaitingLine(d: TimesheetDayLine) {
  return (d.status ?? 'submitted') === 'submitted';
}

function pendingLineCount(item: TimesheetPendingItem) {
  return item.projects.reduce(
    (sum, p) =>
      sum +
      p.tasks.reduce(
        (tSum, t) => tSum + t.days.filter(isWaitingLine).length,
        0,
      ),
    0,
  );
}

/** Hours awaiting approval only — drafts/approved must not inflate the total. */
function pendingDurationMinutes(item: TimesheetPendingItem) {
  return item.projects.reduce(
    (sum, p) =>
      sum +
      p.tasks.reduce(
        (tSum, t) =>
          tSum +
          t.days
            .filter(isWaitingLine)
            .reduce((dSum, d) => dSum + d.durationMinutes, 0),
        0,
      ),
    0,
  );
}

/** Tasks that still have waiting lines (flat — row is already one project). */
function waitingTasks(
  item: TimesheetPendingItem,
): Array<TimesheetTaskBreakdown & { waitingDays: TimesheetDayLine[] }> {
  const out: Array<
    TimesheetTaskBreakdown & { waitingDays: TimesheetDayLine[] }
  > = [];
  for (const project of item.projects) {
    for (const task of project.tasks) {
      const waitingDays = task.days.filter(isWaitingLine);
      if (waitingDays.length === 0) continue;
      out.push({ ...task, waitingDays });
    }
  }
  return out;
}

function sliceClientName(item: TimesheetPendingItem): string {
  const top = item.clientName?.trim();
  if (top) return top;
  for (const p of item.projects) {
    const name = p.clientName?.trim();
    if (name) return name;
  }
  return 'No client';
}

function sliceProjectName(item: TimesheetPendingItem): string {
  return (
    item.projectName?.trim() ||
    item.projects[0]?.projectName?.trim() ||
    'No project'
  );
}

/**
 * Approvals — Pending and Log share one flat table surface.
 */
export default function ApprovalsPage() {
  const toast = useToast();
  const { can, scopeFor } = usePermissions();
  const canApprove = can('timesheet', 'approve');
  const approveScope = scopeFor('timesheet', 'approve');
  const isOrgApprover = approveScope === 'all';

  const [tab, setTab] = useState<MainTab>('pending');
  const [data, setData] = useState<TimesheetPendingItem[]>([]);
  const [pendingView, setPendingView] = useState<'org' | 'managed' | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [approveTarget, setApproveTarget] = useState<ApproveTarget | null>(
    null,
  );
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [logItems, setLogItems] = useState<ApprovalsLogItem[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<LogStatusFilter>('all');
  const [logUserId, setLogUserId] = useState('');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingQuery, setPendingQuery] = useState('');
  const [logQuery, setLogQuery] = useState('');
  const debouncedPendingQ = useDebouncedValue(pendingQuery.trim());
  const debouncedLogQ = useDebouncedValue(logQuery.trim());

  const reloadPending = useCallback(
    async (signal?: AbortSignal) => {
      if (!canApprove) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedPendingQ) params.set('q', debouncedPendingQ);
        const qs = params.toString();
        const res = await api<{
          data: TimesheetPendingItem[];
          total: number;
          view?: 'org' | 'managed';
        }>(`/timesheets/pending${qs ? `?${qs}` : ''}`, { signal });
        setData(res.data ?? []);
        setPendingView(res.view ?? null);
      } catch (err) {
        if (isAbortError(err)) return;
        setData([]);
        setError(getErrorMessage(err, 'Could not load pending approvals'));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [canApprove, debouncedPendingQ],
  );

  const reloadLog = useCallback(
    async (signal?: AbortSignal) => {
      if (!canApprove || !isOrgApprover) return;
      setLogLoading(true);
      setLogError(null);
      try {
        const params = new URLSearchParams();
        if (logStatus !== 'all') params.set('status', logStatus);
        if (logUserId) params.set('userId', logUserId);
        if (logDateFrom) params.set('dateFrom', logDateFrom);
        if (logDateTo) params.set('dateTo', logDateTo);
        if (debouncedLogQ) params.set('q', debouncedLogQ);
        params.set('pageSize', '50');
        const qs = params.toString();
        const res = await api<ApprovalsLogResponse>(
          `/timesheets/approvals-log${qs ? `?${qs}` : ''}`,
          { signal },
        );
        setLogItems(res.data ?? []);
        setLogTotal(res.total ?? 0);
      } catch (err) {
        if (isAbortError(err)) return;
        setLogItems([]);
        setLogTotal(0);
        setLogError(getErrorMessage(err, 'Could not load approvals log'));
      } finally {
        if (!signal?.aborted) setLogLoading(false);
      }
    },
    [
      canApprove,
      isOrgApprover,
      logStatus,
      logUserId,
      logDateFrom,
      logDateTo,
      debouncedLogQ,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void reloadPending(controller.signal);
    return () => controller.abort();
  }, [reloadPending]);

  useEffect(() => {
    if (tab !== 'log' || !isOrgApprover) return;
    const controller = new AbortController();
    void reloadLog(controller.signal);
    return () => controller.abort();
  }, [tab, isOrgApprover, reloadLog]);

  useEffect(() => {
    if (!isOrgApprover) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<Paginated<Member>>(
          '/members?pageSize=100&status=active',
        );
        if (!cancelled) setMembers(res.data ?? []);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOrgApprover]);

  const pageDescription = useMemo(() => {
    if (isOrgApprover) {
      return 'Review pending submissions across the organisation, or browse the full approvals log.';
    }
    return 'Review pending time from your team — people who report to you and time on projects you manage.';
  }, [isOrgApprover]);

  const hasPendingSearch = Boolean(debouncedPendingQ);
  const hasLogSearch = Boolean(debouncedLogQ);

  useEffect(() => {
    if (data.length === 0) return;
    setExpanded((prev) => {
      const next = { ...prev };
      const firstId = data[0]!.id;
      for (const item of data) {
        if (next[item.id] === undefined) {
          next[item.id] = item.id === firstId;
        }
      }
      return next;
    });
  }, [data]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleApproveAll(item: TimesheetPendingItem) {
    setActingKey(`slice:${item.id}`);
    try {
      await api(`/timesheets/${item.id}/approve`, { method: 'POST' });
      toast.success('Approved');
      setApproveTarget(null);
      await reloadPending();
      if (tab === 'log') await reloadLog();
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
      await reloadPending();
      if (tab === 'log') await reloadLog();
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
        toast.success('Rejected');
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
      await reloadPending();
      if (tab === 'log') await reloadLog();
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
          helpKey="approvals"
        />
        <EmptyState
          title="No access"
          description="You need timesheet:approve to review submissions."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Approvals"
        description={pageDescription}
        helpKey="approvals"
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (tab === 'log') void reloadLog();
              else void reloadPending();
            }}
          >
            Refresh
          </Button>
        }
      />

      {isOrgApprover ? (
        <div className="inline-flex flex-wrap rounded-md border border-border/80 bg-paper p-0.5">
          {(
            [
              ['pending', 'Pending'],
              ['log', 'Log'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                tab === id
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-slate hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'pending' || !isOrgApprover ? (
        <>
          {!loading && !error && data.length > 0 && pendingView === 'managed' ? (
            <p className="text-sm text-slate">
              Showing pending items from your team and projects you manage.
            </p>
          ) : null}

          {!loading && !error ? (
            <div className="space-y-3 border-t border-border/50 pt-4">
              <SearchField
                value={pendingQuery}
                onChange={setPendingQuery}
                label="Search"
                placeholder="Requester, client, or project"
              />
            </div>
          ) : null}

          {loading ? (
            <ListSkeleton rows={4} />
          ) : error ? (
            <div className="space-y-3 border-t border-border/50 pt-6">
              <p className="text-sm font-medium text-danger">{error}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void reloadPending()}
              >
                Try again
              </Button>
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              title={
                hasPendingSearch
                  ? 'No matching pending items'
                  : 'No pending approvals'
              }
              description={
                hasPendingSearch
                  ? 'Try another search, or clear the search box.'
                  : isOrgApprover
                    ? 'When someone submits a day or week, each project appears here until it is decided.'
                    : 'Nothing from your team is waiting. When a report or project member submits time, it shows up here with a full breakdown.'
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-navy/10 bg-card shadow-sm shadow-navy/[0.04]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-navy/10 bg-navy/[0.06]">
                      <th className={cn(TH, 'w-10')} aria-label="Expand" />
                      <th className={TH}>Requester</th>
                      <th className={TH}>Client</th>
                      <th className={TH}>Project</th>
                      <th className={TH}>Period</th>
                      <th className={cn(TH, 'text-right')}>Hours</th>
                      <th className={TH}>Submitted</th>
                      <th className={cn(TH, 'text-right')}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => {
                      const label =
                        item.user.name || item.user.email || item.userId;
                      const busy =
                        actingKey === `slice:${item.id}` || Boolean(actingKey);
                      const kind =
                        item.periodKind === 'day'
                          ? 'Day'
                          : item.periodKind === 'week'
                            ? 'Week'
                            : 'Period';
                      const linesWaiting = pendingLineCount(item);
                      const waitingMins = pendingDurationMinutes(item);
                      const open = expanded[item.id] ?? false;
                      const tasksWaiting = waitingTasks(item);
                      const clientName = sliceClientName(item);
                      const projectName = sliceProjectName(item);

                      return (
                        <Fragment key={item.id}>
                          <tr
                            className={cn(
                              'border-b border-navy/10 transition-colors',
                              open
                                ? 'border-l-4 border-l-coral bg-coral-tint/20'
                                : 'border-l-4 border-l-transparent hover:bg-navy/[0.03]',
                            )}
                          >
                            <td className={cn(TD, 'w-10 pr-0')}>
                              <button
                                type="button"
                                onClick={() => toggleExpanded(item.id)}
                                className={cn(
                                  'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                                  open
                                    ? 'bg-coral-tint text-coral'
                                    : 'text-slate hover:bg-navy/5 hover:text-navy',
                                )}
                                aria-expanded={open}
                                aria-label={
                                  open ? 'Hide time lines' : 'Show time lines'
                                }
                              >
                                <IconChevronDown
                                  className={cn(
                                    'h-4 w-4 transition-transform duration-200',
                                    open ? 'rotate-0' : '-rotate-90',
                                  )}
                                />
                              </button>
                            </td>
                            <td className={cn(TD, 'font-medium text-navy')}>
                              {label}
                            </td>
                            <td className={TD}>
                              <span className="inline-flex max-w-full truncate rounded-md bg-navy/10 px-2 py-1 text-sm font-semibold text-navy">
                                {clientName}
                              </span>
                            </td>
                            <td className={cn(TD, 'font-medium text-ink')}>
                              {projectName}
                            </td>
                            <td className={TD}>
                              <p className="text-navy">
                                {formatRange(item.periodStart, item.periodEnd)}
                              </p>
                              <div className="mt-1">
                                <Badge variant="coral" tone="solid">
                                  {kind}
                                </Badge>
                              </div>
                            </td>
                            <td className={cn(TD, 'text-right')}>
                              <p className="tabular-nums text-base font-semibold text-coral">
                                {formatHoursMinutes(waitingMins)}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate">
                                {linesWaiting} pending
                              </p>
                            </td>
                            <td className={cn(TD, 'text-slate')}>
                              {formatDateTime(item.submittedAt)}
                            </td>
                            <td className={cn(TD, 'text-right')}>
                              <div className="inline-flex flex-wrap justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  loading={actingKey === `slice:${item.id}`}
                                  disabled={busy || linesWaiting === 0}
                                  onClick={() =>
                                    setApproveTarget({ kind: 'all', item })
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  disabled={busy || linesWaiting === 0}
                                  onClick={() => {
                                    setRejectTarget({ kind: 'slice', item });
                                    setReason('');
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {open ? (
                            <tr className="border-b border-navy/10 bg-coral-tint/10">
                              <td className="px-3 py-3 sm:px-4" colSpan={8}>
                                {tasksWaiting.length === 0 ? (
                                  <p className="pl-8 text-sm text-slate">
                                    No waiting lines for this project.
                                  </p>
                                ) : (
                                  <div className="ml-8 overflow-hidden rounded-lg border border-coral/20 bg-card shadow-sm shadow-coral/5 sm:ml-10">
                                    <table className="w-full border-collapse text-left text-sm">
                                      <thead>
                                        <tr className="border-b border-coral/15 bg-coral-tint/40">
                                          <th className={cn(TH, 'text-coral-dark/80')}>
                                            Task
                                          </th>
                                          <th className={cn(TH, 'text-coral-dark/80')}>
                                            Ticket
                                          </th>
                                          <th className={cn(TH, 'text-coral-dark/80')}>
                                            Date
                                          </th>
                                          <th className={cn(TH, 'text-coral-dark/80')}>
                                            Time
                                          </th>
                                          <th className={cn(TH, 'text-coral-dark/80')}>
                                            Note
                                          </th>
                                          <th
                                            className={cn(
                                              TH,
                                              'text-right text-coral-dark/80',
                                            )}
                                          >
                                            Actions
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {tasksWaiting.flatMap((task) =>
                                          task.waitingDays.map((day) => {
                                            const lineBusy =
                                              actingKey ===
                                              `line:${day.lineId}`;
                                            const ticketRef =
                                              day.ticketReference?.trim() ||
                                              null;
                                            return (
                                              <tr
                                                key={day.lineId}
                                                className="border-b border-border/40 last:border-b-0 hover:bg-navy/[0.02]"
                                              >
                                                <td className={TD}>
                                                  <Badge
                                                    variant="coral"
                                                    tone="solid"
                                                  >
                                                    {task.taskName}
                                                  </Badge>
                                                </td>
                                                <td className={TD}>
                                                  {ticketRef ? (
                                                    <Badge variant="neutral">
                                                      {ticketRef}
                                                    </Badge>
                                                  ) : (
                                                    <span className="text-slate">
                                                      —
                                                    </span>
                                                  )}
                                                </td>
                                                <td
                                                  className={cn(
                                                    TD,
                                                    'text-slate',
                                                  )}
                                                >
                                                  {formatDay(day.entryDate)}
                                                </td>
                                                <td className={TD}>
                                                  <span className="inline-flex rounded-md bg-navy/5 px-2 py-1 tabular-nums text-sm font-medium text-navy">
                                                    {formatDayLineTimeLabel(
                                                      day,
                                                    )}
                                                  </span>
                                                </td>
                                                <td
                                                  className={cn(
                                                    TD,
                                                    'max-w-[16rem] truncate text-slate',
                                                  )}
                                                >
                                                  {day.description?.trim() ||
                                                    '—'}
                                                </td>
                                                <td
                                                  className={cn(
                                                    TD,
                                                    'text-right',
                                                  )}
                                                >
                                                  <div className="inline-flex gap-1.5">
                                                    <Button
                                                      type="button"
                                                      variant="secondary"
                                                      size="sm"
                                                      disabled={Boolean(
                                                        actingKey,
                                                      )}
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
                                                      variant="danger"
                                                      size="sm"
                                                      disabled={Boolean(
                                                        actingKey,
                                                      )}
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
                                                </td>
                                              </tr>
                                            );
                                          }),
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3 border-t border-border/50 pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate">
                Status
                <Select
                  className="min-w-[140px]"
                  value={logStatus}
                  onChange={(e) =>
                    setLogStatus(e.target.value as LogStatusFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate">
                Person
                <Select
                  className="min-w-[180px]"
                  value={logUserId}
                  onChange={(e) => setLogUserId(e.target.value)}
                >
                  <option value="">Everyone</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name || m.user.email}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate">
                From
                <Input
                  type="date"
                  value={logDateFrom}
                  onChange={(e) => setLogDateFrom(e.target.value)}
                  className="w-auto"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate">
                To
                <Input
                  type="date"
                  value={logDateTo}
                  onChange={(e) => setLogDateTo(e.target.value)}
                  className="w-auto"
                />
              </label>
            </div>
            <SearchField
              value={logQuery}
              onChange={setLogQuery}
              label="Search"
              placeholder="Requester or project"
            />
          </div>

          {logLoading ? (
            <ListSkeleton rows={6} />
          ) : logError ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-danger">{logError}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void reloadLog()}
              >
                Try again
              </Button>
            </div>
          ) : logItems.length === 0 ? (
            <EmptyState
              title={
                hasLogSearch
                  ? 'No matching log rows'
                  : 'No matching submissions'
              }
              description={
                hasLogSearch
                  ? 'Try another search, or clear the search box.'
                  : 'Adjust the filters, or wait for the next timesheet submission.'
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate">
                {logTotal} submission{logTotal === 1 ? '' : 's'}
                {hasLogSearch ? ' matching search' : ''}
              </p>
              <div className="overflow-x-auto border-t border-border/50">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-navy/15">
                      <th className={TH}>Requester</th>
                      <th className={TH}>Approver</th>
                      <th className={TH}>Period</th>
                      <th className={TH}>Project</th>
                      <th className={cn(TH, 'text-right')}>Hours</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Submitted</th>
                      <th className={TH}>Decided</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logItems.map((row) => (
                      <tr
                        key={row.sliceId}
                        className="border-b border-navy/10"
                      >
                        <td className={TD}>
                          <p className="font-medium text-navy">
                            {row.requesterName}
                          </p>
                          <p className="text-xs text-slate">
                            {row.requesterEmail}
                          </p>
                        </td>
                        <td className={cn(TD, 'text-navy')}>
                          {row.approverName || '—'}
                        </td>
                        <td className={cn(TD, 'text-slate')}>
                          {formatRange(row.periodStart, row.periodEnd)}
                        </td>
                        <td className={cn(TD, 'text-navy')}>
                          {row.projectName}
                        </td>
                        <td
                          className={cn(
                            TD,
                            'text-right tabular-nums text-navy',
                          )}
                        >
                          {formatHoursMinutes(row.durationMinutes)}
                        </td>
                        <td className={TD}>
                          <span
                            className={cn(
                              row.status === 'approved'
                                ? 'text-navy'
                                : row.status === 'rejected'
                                  ? 'text-danger'
                                  : 'text-slate',
                            )}
                          >
                            {statusLabel(row.status)}
                          </span>
                          {row.status === 'rejected' && row.reason ? (
                            <p className="mt-0.5 max-w-[12rem] truncate text-xs text-slate">
                              {row.reason}
                            </p>
                          ) : null}
                        </td>
                        <td className={cn(TD, 'text-slate')}>
                          {formatDateTime(row.submittedAt)}
                        </td>
                        <td className={cn(TD, 'text-slate')}>
                          {formatDateTime(row.decidedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title={
          rejectTarget?.kind === 'line'
            ? 'Reject this time?'
            : 'Reject pending lines?'
        }
        description={
          rejectTarget?.kind === 'line'
            ? `This line goes back to the member so they can edit and resubmit${
                rejectTarget.line.ticketReference
                  ? ` (${rejectTarget.line.ticketReference})`
                  : ''
              }. A reason is required.`
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
            ? `Approve ${formatDayLineTimeLabel(approveTarget.line)} on ${formatDay(approveTarget.line.entryDate)}${
                approveTarget.line.ticketReference
                  ? ` · ${approveTarget.line.ticketReference}`
                  : ''
              }${
                approveTarget.line.description
                  ? ` — “${approveTarget.line.description}”`
                  : ''
              }. This locks the line for the member.`
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
        title="Approve pending lines?"
        description={
          approveTarget?.kind === 'all'
            ? `Approve every waiting line for ${approveTarget.item.user?.name || approveTarget.item.user?.email || 'this member'} (${formatRange(approveTarget.item.periodStart, approveTarget.item.periodEnd)}). Approved time becomes locked.`
            : ''
        }
        confirmLabel="Approve"
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
