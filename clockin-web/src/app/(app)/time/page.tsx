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
import {
  TimesheetPanel,
  type TimesheetMode,
} from '@/components/time/TimesheetPanel';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import {
  formatWeekLabel,
  toDateParam,
  weekDayParams,
  weekRange,
} from '@/lib/date-range';
import { getErrorMessage } from '@/lib/get-error-message';
import { formatHoursMinutes } from '@/lib/format-duration';
import {
  findRunningEntry,
  useTimeEntries,
} from '@/lib/use-time-entries';
import { usePermissions } from '@/lib/use-permissions';
import { useAuth } from '@/lib/auth-context';
import { isMemberOnlyRole } from '@/lib/app-nav';
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
  | { type: 'add-time'; taskId?: string; entryDate?: string }
  | { type: 'edit-entry'; entry: TimeEntry }
  | null;

/** FIX 5 — pending confirm for submit / stop timer */
type ConfirmAction =
  | { kind: 'submit-today' }
  | { kind: 'submit-week' }
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
  const { can, highestRole } = usePermissions();
  const canEdit = can('time_entry', 'edit');
  const showBillable = !isMemberOnlyRole(highestRole);
  const myMembershipId = me?.membership?.id ?? null;

  const today = toDateParam(new Date());
  const [mode, setMode] = useState<TimesheetMode>('day');
  /** Anchor for week navigation — independent of calendar. */
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());

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
  const [submittingWeek, setSubmittingWeek] = useState(false);
  const [submittingDay, setSubmittingDay] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);

  const weekLocked = Boolean(weekSheet?.locked);
  const dayLocked = Boolean(daySheet?.locked);
  const canMutateTime = canEdit && !weekLocked;

  const weekDays = useMemo(() => weekDayParams(weekAnchor), [weekAnchor]);
  const weekFrom = weekDays[0];
  const weekTo = weekDays[6];
  const weekBounds = useMemo(() => weekRange(weekAnchor), [weekAnchor]);
  const isCurrentWeek =
    weekFrom === weekDayParams(new Date())[0] &&
    weekTo === weekDayParams(new Date())[6];

  const periodFrom = mode === 'day' ? today : weekFrom;
  const periodTo = mode === 'day' ? today : weekTo;

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
    if (!taskId && add !== '1') return;

    if (add === '1' && canMutateTime) {
      setModal({ type: 'add-time', taskId });
      router.replace('/time', { scroll: false });
      return;
    }

    if (taskId && canMutateTime) {
      setPendingTrackTaskId(taskId);
      router.replace('/time', { scroll: false });
    }
  }, [searchParams, canMutateTime, router]);

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

  useEffect(() => {
    void loadWeekSheet();
  }, [loadWeekSheet, periodEntries, mode]);

  useEffect(() => {
    void loadDaySheet();
  }, [loadDaySheet, todayEntries]);

  function shiftWeek(delta: number) {
    setWeekAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
  }

  async function handleSubmitWeek() {
    setSubmittingWeek(true);
    try {
      await api('/timesheets/submit', {
        method: 'POST',
        body: { periodStart: weekFrom, periodEnd: weekTo },
      });
      toast.success('Week submitted for approval');
      setConfirmAction(null);
      refresh();
      await loadWeekSheet();
      await loadDaySheet();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit week'));
    } finally {
      setSubmittingWeek(false);
    }
  }

  async function handleSubmitToday() {
    setSubmittingDay(true);
    try {
      await api('/timesheets/submit', {
        method: 'POST',
        body: { periodStart: today, periodEnd: today },
      });
      toast.success('Today submitted for approval');
      setConfirmAction(null);
      refresh();
      await loadWeekSheet();
      await loadDaySheet();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit today'));
    } finally {
      setSubmittingDay(false);
    }
  }

  async function handleSubmitTask(taskId: string) {
    setSubmittingTaskId(taskId);
    try {
      const periodStart = mode === 'day' ? today : weekFrom;
      const periodEnd = mode === 'day' ? today : weekTo;
      await api('/timesheets/submit', {
        method: 'POST',
        body: { periodStart, periodEnd, taskId },
      });
      toast.success('Task time submitted for approval');
      setConfirmAction(null);
      refresh();
      await loadWeekSheet();
      await loadDaySheet();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit task'));
    } finally {
      setSubmittingTaskId(null);
    }
  }

  async function handleStart(values: { description: string; taskId: string }) {
    if (running) {
      toast.error('Stop the current timer first');
      return;
    }
    if (!values.taskId) {
      toast.error('Pick an assigned task before starting the timer');
      return;
    }
    setStarting(true);
    try {
      const body: CreateTimeEntryInput = {
        entryDate: today,
        source: 'timer',
        line: {
          durationMinutes: 1,
          description: values.description.trim() || undefined,
          taskId: values.taskId,
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
    setStopping(true);
    try {
      await api(`/time-entries/${running.id}/stop`, {
        method: 'PATCH',
        body: {},
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
    if (confirmAction.kind === 'submit-today') void handleSubmitToday();
    else if (confirmAction.kind === 'submit-week') void handleSubmitWeek();
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
          ...(values.mode === 'range'
            ? {
                startTime: range.startTime,
                endTime: range.endTime,
              }
            : {}),
        } satisfies UpdateTimeEntryInput,
      });
      await api(`/time-lines/${line.id}`, {
        method: 'PATCH',
        body: {
          taskId: values.taskId,
          durationMinutes,
          description: values.description.trim() || null,
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
      await loadWeekSheet();
      await loadDaySheet();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete'));
    } finally {
      setDeleteLoading(false);
    }
  }

  const activeSheet = mode === 'day' ? daySheet : weekSheet;
  const periodLocked = mode === 'day' ? dayLocked : weekLocked;

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
  const overEightHours = todayTotalMinutes > 8 * 60;
  const timerBlockingSubmit = Boolean(running);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Timesheet"
        description="Log time on your project tasks, then submit for approval."
      />

      {/* Period strip — flat, less boxy */}
      <div className="rounded-xl border border-border/50 bg-paper/60 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'day' ? (
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  Today · {today}
                </h2>
              ) : (
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  Week of {formatWeekLabel(weekBounds.from, weekBounds.to)}
                </h2>
              )}
              {activeSheet ? (
                <Badge
                  variant={
                    activeSheet.period?.status === 'approved'
                      ? 'success'
                      : activeSheet.period?.status === 'rejected'
                        ? 'danger'
                        : activeSheet.period?.status === 'submitted'
                          ? 'warning'
                          : 'neutral'
                  }
                >
                  {activeSheet.period?.status ?? 'draft'}
                </Badge>
              ) : null}
            </div>

            <div
              className="inline-flex rounded-lg bg-card/90 p-0.5 ring-1 ring-border/40"
              role="group"
              aria-label="Timesheet period"
            >
              <button
                type="button"
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                  mode === 'day'
                    ? 'bg-paper text-ink shadow-sm'
                    : 'text-slate hover:text-ink'
                }`}
                onClick={() => setMode('day')}
              >
                Day
              </button>
              <button
                type="button"
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                  mode === 'week'
                    ? 'bg-paper text-ink shadow-sm'
                    : 'text-slate hover:text-ink'
                }`}
                onClick={() => setMode('week')}
              >
                Week
              </button>
            </div>

            <p className="text-sm text-slate">
              {timerBlockingSubmit
                ? 'Stop the running timer before submitting.'
                : periodLocked
                  ? mode === 'day'
                    ? 'Today is locked — entries are read-only.'
                    : 'This week is locked — entries are read-only.'
                  : mode === 'week' &&
                      weekSheet?.conflictDays &&
                      weekSheet.conflictDays.length > 0
                    ? `Some days already submitted (${weekSheet.conflictDays.join(', ')}).`
                    : mode === 'day'
                      ? 'Submit when you finish logging for today.'
                      : 'Submit the full week when ready.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            {canEdit ? (
              mode === 'day' ? (
                <Button
                  type="button"
                  loading={submittingDay}
                  disabled={
                    submittingDay ||
                    !daySheet?.canSubmit ||
                    dayLocked ||
                    timerBlockingSubmit
                  }
                  onClick={() => setConfirmAction({ kind: 'submit-today' })}
                >
                  Submit today
                </Button>
              ) : (
                <Button
                  type="button"
                  loading={submittingWeek}
                  disabled={
                    submittingWeek ||
                    !weekSheet?.canSubmit ||
                    weekLocked ||
                    timerBlockingSubmit
                  }
                  onClick={() => setConfirmAction({ kind: 'submit-week' })}
                >
                  Submit week
                </Button>
              )
            ) : null}
            {canMutateTime ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setModal({ type: 'add-time' })}
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

        <div className="mt-3.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border/40 pt-3">
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
          {overEightHours ? (
            <p className="text-sm text-warning">
              Over 8 hours — check your entries if that was not intentional.
            </p>
          ) : null}
        </div>
      </div>

      <TimerBar
        running={running}
        tasks={tasks}
        projects={projects}
        canEdit={canMutateTime && !dayLocked}
        showBillable={showBillable}
        starting={starting}
        stopping={stopping}
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
        <TimesheetPanel
          mode={mode}
          tasks={tasks}
          projectsById={projectsById}
          entries={periodEntries}
          canEdit={canMutateTime && !(mode === 'day' && dayLocked)}
          canSubmit={
            Boolean(activeSheet?.canSubmit) &&
            !periodLocked &&
            !timerBlockingSubmit
          }
          submittingTaskId={submittingTaskId}
          timerBusy={starting || stopping}
          runningTaskId={runningTaskId}
          defaultEntryDate={mode === 'day' ? today : weekFrom}
          onAddTime={(taskId, entryDate) => {
            const day = entryDate ?? today;
            if (day > today) {
              toast.error('Cannot log time for a future date');
              return;
            }
            setModal({ type: 'add-time', taskId, entryDate: day });
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
      >
        {modal?.type === 'add-time' ? (
          <AddTimeForm
            tasks={tasks}
            projects={projects}
            defaultTaskId={modal.taskId}
            defaultDate={modal.entryDate ?? today}
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
        open={confirmAction?.kind === 'submit-today'}
        title="Submit today?"
        description="Your draft time for today will be sent for approval. You won’t be able to edit those entries until they’re rejected or unlocked."
        confirmLabel="Submit today"
        loading={submittingDay}
        onConfirm={() => runConfirmedAction()}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'submit-week'}
        title="Submit week?"
        description={`Your draft time for the week of ${formatWeekLabel(weekBounds.from, weekBounds.to)} will be sent for approval. Submitted entries become read-only.`}
        confirmLabel="Submit week"
        loading={submittingWeek}
        onConfirm={() => runConfirmedAction()}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'submit-task'}
        title="Submit task time?"
        description={
          confirmAction?.kind === 'submit-task'
            ? `Draft time on “${confirmAction.taskName}” will be sent for approval. Those entries become read-only until rejected or unlocked.`
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
