'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TimerBar } from '@/components/time/TimerBar';
import {
  AddTimeForm,
  durationMinutesFromAddValues,
  isoRangeFromAddValues,
  type AddTimeValues,
} from '@/components/time/AddTimeForm';
import { DayHourSlots } from '@/components/time/DayHourSlots';
import {
  TimesheetPanel,
  type TimesheetMode,
} from '@/components/time/TimesheetPanel';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api-client';
import {
  dateParamsInRange,
  formatDisplayDate,
  formatDisplayDateRange,
  formatWeekLabel,
  toDateParam,
  weekdayShort,
  weekDayParams,
  weekRange,
} from '@/lib/date-range';
import { suggestNextRange } from '@/lib/day-hour-slots';
import { getErrorMessage } from '@/lib/get-error-message';
import { formatHoursMinutes } from '@/lib/format-duration';
import { wallIsoNowOnDate } from '@/lib/wall-clock';
import {
  findRunningEntry,
  useTimeEntries,
} from '@/lib/use-time-entries';
import { usePermissions } from '@/lib/use-permissions';
import { useAuth } from '@/lib/auth-context';
import type {
  CreateTimeEntryInput,
  Paginated,
  Project,
  Task,
  TimeEntry,
  TimesheetMineResponse,
  UpdateTimeEntryInput,
  UpdateTimeLineInput,
} from '@/types/api';

type ModalKind =
  | {
      type: 'add-time';
      taskId?: string;
      entryDate?: string;
      startTime?: string;
      endTime?: string;
      ticketId?: string;
      projectId?: string;
      clientId?: string;
    }
  | { type: 'edit-entry'; entry: TimeEntry }
  | null;

/** FIX 5 — pending confirm for submit / stop timer */
type ConfirmAction =
  | { kind: 'submit-period' }
  | { kind: 'submit-task'; taskId: string; taskName: string }
  | { kind: 'stop-timer' };

/**
 * Timesheet — day/week submission sheet (timer + nested entries). Calendar is /calendar.
 */
function TimePageInner() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('time_entry', 'edit');
  const myMembershipId = me?.membership?.id ?? null;

  const today = toDateParam(new Date());
  const [mode, setMode] = useState<TimesheetMode>('day');
  /** Anchor for week navigation — independent of calendar. */
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const initialWeek = weekRange();
  const [customFrom, setCustomFrom] = useState(() =>
    toDateParam(initialWeek.from),
  );
  const [customTo, setCustomTo] = useState(() => toDateParam(initialWeek.to));
  /** Selected day for the horizontal slot bar (week/period). */
  const [slotDay, setSlotDay] = useState(() => toDateParam(new Date()));

  const [modal, setModal] = useState<ModalKind>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekSheet, setWeekSheet] = useState<TimesheetMineResponse | null>(
    null,
  );
  const [daySheet, setDaySheet] = useState<TimesheetMineResponse | null>(null);
  const [customSheet, setCustomSheet] =
    useState<TimesheetMineResponse | null>(null);
  const [submittingPeriod, setSubmittingPeriod] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);

  const weekLocked = Boolean(weekSheet?.locked);
  const dayLocked = Boolean(daySheet?.locked);
  const customLocked = Boolean(customSheet?.locked);

  const weekDays = useMemo(() => weekDayParams(weekAnchor), [weekAnchor]);
  const weekFrom = weekDays[0];
  const weekTo = weekDays[6];
  const weekBounds = useMemo(() => weekRange(weekAnchor), [weekAnchor]);
  const isCurrentWeek =
    weekFrom === weekDayParams(new Date())[0] &&
    weekTo === weekDayParams(new Date())[6];

  const customRange = useMemo(() => {
    let from = customFrom;
    let to = customTo;
    if (from > to) {
      const swap = from;
      from = to;
      to = swap;
    }
    return { from, to };
  }, [customFrom, customTo]);

  const periodFrom =
    mode === 'day'
      ? today
      : mode === 'week'
        ? weekFrom
        : customRange.from;
  const periodTo =
    mode === 'day' ? today : mode === 'week' ? weekTo : customRange.to;

  const {
    data: periodEntries,
    loading,
    error,
    reload: reloadPeriod,
  } = useTimeEntries({
    dateFrom: periodFrom,
    dateTo: periodTo,
    pageSize: 100,
  });

  const {
    data: todayEntries,
    reload: reloadToday,
  } = useTimeEntries({
    dateFrom: today,
    dateTo: today,
    pageSize: 100,
  });

  // FIX 4 — always load current week for weekly total (even in Day mode)
  const {
    data: weekEntries,
    reload: reloadWeek,
  } = useTimeEntries({
    dateFrom: weekFrom,
    dateTo: weekTo,
    pageSize: 100,
  });

  const running =
    findRunningEntry(todayEntries) ??
    findRunningEntry(periodEntries) ??
    findRunningEntry(weekEntries);
  const runningTaskId = running?.timeLines?.[0]?.taskId ?? null;

  const [pendingTrackTaskId, setPendingTrackTaskId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const add = searchParams.get('add');
    const taskId = searchParams.get('taskId') ?? undefined;
    const ticketId = searchParams.get('ticketId') ?? undefined;
    const projectId = searchParams.get('projectId') ?? undefined;
    const clientId = searchParams.get('clientId') ?? undefined;
    if (!taskId && add !== '1' && !ticketId) return;

    if ((add === '1' || ticketId) && canMutateTime) {
      setModal({
        type: 'add-time',
        taskId,
        ticketId,
        projectId,
        clientId,
      });
      router.replace('/time', { scroll: false });
      return;
    }

    if (taskId && canEdit) {
      setPendingTrackTaskId(taskId);
      router.replace('/time', { scroll: false });
    }
  }, [searchParams, canEdit, router]);

  useEffect(() => {
    let cancelled = false;
    async function loadLookups() {
      if (!myMembershipId) return;

      try {
        // FIX 1 (refine) — tasks on any project the member is on (API taskWhere)
        const taskParams = new URLSearchParams({
          pageSize: '100',
          status: 'open',
        });
        const tasksRes = await api<Paginated<Task>>(
          `/tasks?${taskParams.toString()}`,
        );
        if (!cancelled) {
          setTasks(tasksRes.data ?? []);
        }
      } catch {
        if (!cancelled) setTasks([]);
      }

      try {
        const projectsRes = await api<Paginated<Project>>(
          '/projects?pageSize=100&status=active',
        );
        if (!cancelled) setProjects(projectsRes.data ?? []);
      } catch {
        if (!cancelled) setProjects([]);
      }
    }
    void loadLookups();
    return () => {
      cancelled = true;
    };
  }, [myMembershipId]);

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const refresh = useCallback(() => {
    reloadPeriod();
    reloadToday();
    reloadWeek();
  }, [reloadPeriod, reloadToday, reloadWeek]);

  const loadWeekSheet = useCallback(async () => {
    if (!canEdit) {
      setWeekSheet(null);
      return;
    }
    try {
      const params = new URLSearchParams({
        periodStart: weekFrom,
        periodEnd: weekTo,
      });
      const res = await api<TimesheetMineResponse>(
        `/timesheets/me?${params.toString()}`,
      );
      setWeekSheet(res);
    } catch {
      setWeekSheet(null);
    }
  }, [canEdit, weekFrom, weekTo]);

  const loadDaySheet = useCallback(async () => {
    if (!canEdit) {
      setDaySheet(null);
      return;
    }
    try {
      const params = new URLSearchParams({
        periodStart: today,
        periodEnd: today,
      });
      const res = await api<TimesheetMineResponse>(
        `/timesheets/me?${params.toString()}`,
      );
      setDaySheet(res);
    } catch {
      setDaySheet(null);
    }
  }, [canEdit, today]);

  const loadCustomSheet = useCallback(async () => {
    if (!canEdit) {
      setCustomSheet(null);
      return;
    }
    try {
      const params = new URLSearchParams({
        periodStart: customRange.from,
        periodEnd: customRange.to,
      });
      const res = await api<TimesheetMineResponse>(
        `/timesheets/me?${params.toString()}`,
      );
      setCustomSheet(res);
    } catch {
      setCustomSheet(null);
    }
  }, [canEdit, customRange.from, customRange.to]);

  useEffect(() => {
    void loadWeekSheet();
  }, [loadWeekSheet, periodEntries, mode]);

  useEffect(() => {
    void loadDaySheet();
  }, [loadDaySheet, todayEntries]);

  useEffect(() => {
    if (mode !== 'period') return;
    void loadCustomSheet();
  }, [loadCustomSheet, periodEntries, mode]);

  function shiftWeek(delta: number) {
    setWeekAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
  }

  async function reloadSheets() {
    await loadWeekSheet();
    await loadDaySheet();
    if (mode === 'period') await loadCustomSheet();
  }

  async function handleSubmitPeriod() {
    setSubmittingPeriod(true);
    try {
      await api('/timesheets/submit', {
        method: 'POST',
        body: { periodStart: periodFrom, periodEnd: periodTo },
      });
      toast.success('Submitted for approval');
      setConfirmAction(null);
      refresh();
      await reloadSheets();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit'));
    } finally {
      setSubmittingPeriod(false);
    }
  }

  async function handleSubmitTask(taskId: string) {
    setSubmittingTaskId(taskId);
    try {
      await api('/timesheets/submit', {
        method: 'POST',
        body: { periodStart: periodFrom, periodEnd: periodTo, taskId },
      });
      toast.success('Task time submitted for approval');
      setConfirmAction(null);
      refresh();
      await reloadSheets();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit task'));
    } finally {
      setSubmittingTaskId(null);
    }
  }

  async function handleStart(values: {
    description: string;
    taskId: string;
    ticketId?: string;
  }) {
    if (running) {
      toast.error('Stop the current timer first');
      return;
    }
    if (!values.taskId) {
      toast.error('Pick an assigned task before starting the timer');
      return;
    }
    if (todayTotalMinutes >= 8 * 60) {
      toast.error(
        'Daily 8h limit reached — edit or remove time before starting a timer.',
      );
      return;
    }
    setStarting(true);
    try {
      const body: CreateTimeEntryInput = {
        entryDate: today,
        source: 'timer',
        startTime: wallIsoNowOnDate(today),
        line: {
          durationMinutes: 1,
          description: values.description.trim() || undefined,
          taskId: values.taskId,
          ...(values.ticketId ? { ticketId: values.ticketId } : {}),
        },
      };
      await api<TimeEntry>('/time-entries', { method: 'POST', body });
      toast.success('Timer started');
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not start timer'));
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    if (!running) return;
    if (running.startTime) {
      const elapsed = Math.max(
        1,
        Math.round(
          (Date.now() - new Date(running.startTime).getTime()) / 60_000,
        ),
      );
      const runningMins = (running.timeLines ?? []).reduce(
        (s, line) => s + (line.durationMinutes ?? 0),
        0,
      );
      const withoutRunning = Math.max(0, todayTotalMinutes - runningMins);
      if (withoutRunning + elapsed > 8 * 60) {
        const remaining = Math.max(0, 8 * 60 - withoutRunning);
        toast.error(
          `Stopping would exceed the 8h daily limit (${remaining}m remaining, timer at ${elapsed}m). Edit or remove other time first.`,
        );
        setConfirmAction(null);
        return;
      }
    }
    setStopping(true);
    try {
      await api(`/time-entries/${running.id}/stop`, {
        method: 'PATCH',
        body: {
          endTime: wallIsoNowOnDate(
            running.entryDate?.slice(0, 10) || today,
          ),
        },
      });
      toast.success('Timer stopped');
      setConfirmAction(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not stop timer'));
    } finally {
      setStopping(false);
    }
  }

  function runConfirmedAction() {
    if (!confirmAction) return;
    if (confirmAction.kind === 'submit-period') void handleSubmitPeriod();
    else if (confirmAction.kind === 'submit-task') {
      void handleSubmitTask(confirmAction.taskId);
    } else if (confirmAction.kind === 'stop-timer') void handleStop();
  }

  async function handleAddTimeSubmit(values: AddTimeValues) {
    setSubmitting(true);
    try {
      const durationMinutes = durationMinutesFromAddValues(values);
      const range = isoRangeFromAddValues(values);
      const body: CreateTimeEntryInput = {
        entryDate: values.entryDate,
        source: 'manual',
        startTime: range.startTime,
        endTime: range.endTime,
        line: {
          taskId: values.taskId,
          durationMinutes,
          description: values.description.trim() || undefined,
          ...(values.ticketId ? { ticketId: values.ticketId } : {}),
        },
      };
      await api<TimeEntry>('/time-entries', { method: 'POST', body });
      toast.success('Time entry added');
      setModal(null);
      refresh();
      await loadWeekSheet();
      await loadDaySheet();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add time'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditEntrySubmit(values: AddTimeValues) {
    if (!modal || modal.type !== 'edit-entry') return;
    const entry = modal.entry;
    const line = entry.timeLines?.[0];
    if (!line) return;
    setSubmitting(true);
    try {
      const durationMinutes = durationMinutesFromAddValues(values);
      const range = isoRangeFromAddValues(values);
      await api(`/time-entries/${entry.id}`, {
        method: 'PATCH',
        body: {
          entryDate: values.entryDate,
          startTime: range.startTime,
          endTime: range.endTime,
        } satisfies UpdateTimeEntryInput,
      });
      await api(`/time-lines/${line.id}`, {
        method: 'PATCH',
        body: {
          taskId: values.taskId,
          durationMinutes,
          description: values.description.trim() || null,
          ticketId: values.ticketId || null,
        } satisfies UpdateTimeLineInput,
      });
      toast.success('Entry updated');
      setModal(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update entry'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api(`/time-entries/${deleting.id}`, { method: 'DELETE' });
      toast.success('Entry deleted');
      setDeleting(null);
      refresh();
      await reloadSheets();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete'));
    } finally {
      setDeleteLoading(false);
    }
  }

  const activeSheet =
    mode === 'day' ? daySheet : mode === 'week' ? weekSheet : customSheet;
  const periodLocked =
    mode === 'day' ? dayLocked : mode === 'week' ? weekLocked : customLocked;
  const canMutateTime = canEdit && !periodLocked;

  const periodDayList = useMemo(() => {
    if (mode === 'day') return [today];
    if (mode === 'week') return weekDays;
    return dateParamsInRange(customRange.from, customRange.to);
  }, [mode, today, weekDays, customRange.from, customRange.to]);

  useEffect(() => {
    if (mode === 'day') {
      setSlotDay(today);
      return;
    }
    if (mode === 'week') {
      setSlotDay(weekDays.includes(today) ? today : weekFrom);
      return;
    }
    setSlotDay((prev) =>
      periodDayList.includes(prev) ? prev : (periodDayList[0] ?? customRange.from),
    );
  }, [
    mode,
    today,
    weekDays,
    weekFrom,
    customRange.from,
    periodDayList,
  ]);

  const activeSlotDay = mode === 'day' ? today : slotDay;

  const todayTotalMinutes = useMemo(
    () =>
      todayEntries.reduce(
        (sum, entry) =>
          sum +
          (entry.timeLines ?? []).reduce(
            (s, line) => s + (line.durationMinutes ?? 0),
            0,
          ),
        0,
      ),
    [todayEntries],
  );
  const weekTotalMinutes = useMemo(
    () =>
      weekEntries.reduce(
        (sum, entry) =>
          sum +
          (entry.timeLines ?? []).reduce(
            (s, line) => s + (line.durationMinutes ?? 0),
            0,
          ),
        0,
      ),
    [weekEntries],
  );
  const atDailyCap = todayTotalMinutes >= 8 * 60;
  const dailyRemaining = Math.max(0, 8 * 60 - todayTotalMinutes);
  const nearDailyCap = !atDailyCap && dailyRemaining <= 60;
  const timerBlockingSubmit = Boolean(running);

  function openAddTime(opts?: {
    taskId?: string;
    entryDate?: string;
    startTime?: string;
    endTime?: string;
  }) {
    const day = opts?.entryDate ?? activeSlotDay;
    if (day > today) {
      toast.error('Cannot log time for a future date');
      return;
    }
    if (day === today && atDailyCap) {
      toast.error(
        'Daily 8h limit reached — edit or remove time before adding more.',
      );
      return;
    }
    const suggested =
      opts?.startTime && opts?.endTime
        ? { startTime: opts.startTime, endTime: opts.endTime }
        : suggestNextRange(periodEntries, day);
    setModal({
      type: 'add-time',
      taskId: opts?.taskId,
      entryDate: day,
      startTime: suggested.startTime,
      endTime: suggested.endTime,
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Timesheet"
        description="Log time on your project tasks, then submit for approval."
        helpKey="timesheet"
      />

      {/* Period toolbar — flat under header */}
      <div className="space-y-3 border-b border-border/50 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'day' ? (
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  Today · {formatDisplayDate(today)}
                </h2>
              ) : mode === 'week' ? (
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  Week of {formatWeekLabel(weekBounds.from, weekBounds.to)}
                </h2>
              ) : (
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  {formatDisplayDateRange(customRange.from, customRange.to)}
                </h2>
              )}
              {periodLocked ? (
                <span className="text-xs font-medium uppercase tracking-wide text-slate">
                  Locked
                </span>
              ) : null}
            </div>

            <div
              className="inline-flex rounded-lg bg-paper/80 p-0.5 ring-1 ring-border/40"
              role="group"
              aria-label="Timesheet period"
            >
              {(
                [
                  ['day', 'Day'],
                  ['week', 'Week'],
                  ['period', 'Period'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                    mode === id
                      ? 'bg-card text-ink shadow-sm'
                      : 'text-slate hover:text-ink'
                  }`}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'period' ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-slate">
                  From
                  <Input
                    type="date"
                    value={customFrom}
                    max={today}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-auto"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate">
                  To
                  <Input
                    type="date"
                    value={customTo}
                    max={today}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-auto"
                  />
                </label>
              </div>
            ) : null}

            <p className="text-sm text-slate">
              {timerBlockingSubmit
                ? 'Stop the running timer before submitting.'
                : periodLocked
                  ? 'This period is locked — entries are read-only.'
                  : activeSheet?.conflictDays &&
                      activeSheet.conflictDays.length > 0
                    ? `Some days already submitted (${activeSheet.conflictDays
                        .map((d) => formatDisplayDate(d))
                        .join(', ')}).`
                    : 'Submit draft time when ready. After approval you can still add drafts and submit again.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            {canEdit ? (
              <Button
                type="button"
                loading={submittingPeriod}
                disabled={
                  submittingPeriod ||
                  !activeSheet?.canSubmit ||
                  periodLocked ||
                  timerBlockingSubmit
                }
                onClick={() => setConfirmAction({ kind: 'submit-period' })}
              >
                Submit
              </Button>
            ) : null}
            {canMutateTime ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={atDailyCap && mode === 'day'}
                onClick={() => openAddTime()}
              >
                Add time
              </Button>
            ) : null}
            {mode === 'week' ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => shiftWeek(-1)}
                >
                  Prev
                </Button>
                {!isCurrentWeek ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setWeekAnchor(new Date())}
                  >
                    This week
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => shiftWeek(1)}
                  disabled={isCurrentWeek}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-sm text-ink">
            <span className="font-medium tabular-nums">
              {formatHoursMinutes(todayTotalMinutes)}
            </span>
            <span className="text-slate"> of 8h today</span>
          </p>
          <p className="text-sm text-ink">
            <span className="font-medium tabular-nums">
              {formatHoursMinutes(weekTotalMinutes)}
            </span>
            <span className="text-slate"> this week</span>
          </p>
          {atDailyCap ? (
            <p className="text-sm text-danger">
              Daily 8h limit reached — stop or edit existing time before adding
              more.
            </p>
          ) : nearDailyCap ? (
            <p className="text-sm text-slate">
              {formatHoursMinutes(dailyRemaining)} left before the 8h daily
              limit.
            </p>
          ) : null}
        </div>
      </div>

      <TimerBar
        running={running}
        tasks={tasks}
        projects={projects}
        canEdit={canMutateTime && !dayLocked}
        starting={starting}
        stopping={stopping}
        atDailyCap={atDailyCap}
        preselectTaskId={pendingTrackTaskId}
        onPreselectConsumed={() => setPendingTrackTaskId(null)}
        onStart={handleStart}
        onStop={async () => {
          setConfirmAction({ kind: 'stop-timer' });
        }}
      />

      {loading && periodEntries.length === 0 ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-6">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={reloadPeriod}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate">
                Day slots · {formatDisplayDate(activeSlotDay)}
              </p>
            </div>
            {mode !== 'day' ? (
              <div className="flex flex-wrap gap-1.5">
                {periodDayList.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSlotDay(day)}
                    className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition ring-1 ${
                      activeSlotDay === day
                        ? 'bg-card text-ink shadow-sm ring-border'
                        : 'bg-paper/60 text-slate ring-border/40 hover:text-ink'
                    }`}
                  >
                    <span className="block">{weekdayShort(day)}</span>
                    <span className="block tabular-nums opacity-80">
                      {formatDisplayDate(day)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <DayHourSlots
              entryDate={activeSlotDay}
              entries={periodEntries}
              projectsById={projectsById}
              tasks={tasks}
              disabled={!canMutateTime}
              onAddRange={(range) =>
                openAddTime({
                  entryDate: range.entryDate,
                  startTime: range.startTime,
                  endTime: range.endTime,
                })
              }
            />
          </div>
          <TimesheetPanel
            mode={mode}
            tasks={tasks}
            projectsById={projectsById}
            entries={periodEntries}
            canEdit={canMutateTime}
            canSubmit={
              Boolean(activeSheet?.canSubmit) &&
              !periodLocked &&
              !timerBlockingSubmit
            }
            submittingTaskId={submittingTaskId}
            timerBusy={starting || stopping}
            runningTaskId={runningTaskId}
            defaultEntryDate={activeSlotDay}
            onAddTime={(taskId, entryDate) => {
              openAddTime({
                taskId,
                entryDate: entryDate ?? activeSlotDay,
              });
            }}
            onEditEntry={(entry) => setModal({ type: 'edit-entry', entry })}
            onDeleteEntry={(entry) => setDeleting(entry)}
            onStartTimer={(taskId) => {
              void handleStart({ description: '', taskId });
            }}
            onSubmitTask={(taskId) => {
              const task = tasks.find((t) => t.id === taskId);
              setConfirmAction({
                kind: 'submit-task',
                taskId,
                taskName: task?.name ?? 'this task',
              });
            }}
          />
        </div>
      )}

      <Modal
        open={modal?.type === 'add-time'}
        title={
          modal?.type === 'add-time' &&
          modal.taskId &&
          periodEntries.some((e) =>
            (e.timeLines ?? []).some((l) => l.taskId === modal.taskId),
          )
            ? 'Add more time'
            : 'Add time'
        }
        description="One task per time slot. Start and end must not overlap another entry."
        onClose={() => !submitting && setModal(null)}
        size="xl"
      >
        {modal?.type === 'add-time' ? (
          <AddTimeForm
            tasks={tasks}
            projects={projects}
            defaultTaskId={modal.taskId}
            defaultProjectId={modal.projectId}
            defaultClientId={modal.clientId}
            defaultTicketId={modal.ticketId}
            defaultDate={
              modal.entryDate ??
              (mode === 'period' ? customRange.from : today)
            }
            defaultRange={
              modal.startTime && modal.endTime
                ? { startTime: modal.startTime, endTime: modal.endTime }
                : null
            }
            existingEntries={[...periodEntries, ...todayEntries]}
            submitting={submitting}
            submitLabel="Add entry"
            onSubmit={handleAddTimeSubmit}
            onCancel={() => setModal(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={modal?.type === 'edit-entry'}
        title="Edit entry"
        description="Update task, time, and note. Locked periods cannot be changed."
        onClose={() => !submitting && setModal(null)}
        size="xl"
      >
        {modal?.type === 'edit-entry' ? (
          <AddTimeForm
            tasks={tasks}
            projects={projects}
            initialEntry={modal.entry}
            existingEntries={[...periodEntries, ...todayEntries]}
            submitting={submitting}
            submitLabel="Save entry"
            onSubmit={handleEditEntrySubmit}
            onCancel={() => setModal(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete entry?"
        description="This removes the time entry and its hours from the period."
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'submit-period'}
        title={
          mode === 'day'
            ? 'Submit this day?'
            : mode === 'week'
              ? 'Submit this week?'
              : 'Submit this period?'
        }
        description={`Only current draft and rejected entries for ${formatDisplayDateRange(periodFrom, periodTo)} will be submitted. Already-submitted lines stay as they are. You can add more drafts later and submit again.`}
        confirmLabel="Submit"
        loading={submittingPeriod}
        onConfirm={() => runConfirmedAction()}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'submit-task'}
        title="Submit task time?"
        description={
          confirmAction?.kind === 'submit-task'
            ? `Only draft and rejected time on “${confirmAction.taskName}” will be submitted. Already-submitted lines on this task stay as they are.`
            : ''
        }
        confirmLabel="Submit task"
        loading={Boolean(submittingTaskId)}
        onConfirm={() => runConfirmedAction()}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'stop-timer'}
        title="Stop timer?"
        description="Stopping finalises this timer as a time entry. You can still edit it while it stays in draft."
        confirmLabel="Stop timer"
        loading={stopping}
        onConfirm={() => runConfirmedAction()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

export default function TimePage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <TimePageInner />
    </Suspense>
  );
}
