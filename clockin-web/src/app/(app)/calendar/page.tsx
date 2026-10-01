'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TimeCalendar,
  type CalendarCreateRange,
} from '@/components/time/TimeCalendar';
import {
  AddTimeForm,
  durationMinutesFromAddValues,
  isoRangeFromAddValues,
  type AddTimeValues,
} from '@/components/time/AddTimeForm';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { toDateParam } from '@/lib/date-range';
import { getErrorMessage } from '@/lib/get-error-message';
import { useTimeEntries } from '@/lib/use-time-entries';
import { usePermissions } from '@/lib/use-permissions';
import { useAuth } from '@/lib/auth-context';
import type {
  CreateTimeEntryInput,
  Paginated,
  Project,
  Task,
  TimeEntry,
  UpdateTimeEntryInput,
  UpdateTimeLineInput,
} from '@/types/api';

type ModalKind =
  | { type: 'create'; range: CalendarCreateRange }
  | { type: 'edit-entry'; entry: TimeEntry }
  | null;

/**
 * Calendar — month/week/day overview of logged time. Submit lives on Timesheet.
 * FIX 3 — do not feed datesSet back into FullCalendar initialDate (remount loop).
 */
export default function CalendarPage() {
  const toast = useToast();
  const { me } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('time_entry', 'edit');
  const myMembershipId = me?.membership?.id ?? null;

  // Fetch window only — never used as FullCalendar initialDate.
  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toDateParam(d);
  });
  const [rangeTo, setRangeTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return toDateParam(d);
  });

  const [modal, setModal] = useState<ModalKind>(null);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Once shown, keep FullCalendar mounted across refetches (avoids flicker
  // and re-applying a stale initialDate when entries briefly empty).
  const [calendarReady, setCalendarReady] = useState(false);

  const canMutateTime = canEdit;

  const {
    data: entries,
    loading,
    error,
    reload,
  } = useTimeEntries({
    dateFrom: rangeFrom,
    dateTo: rangeTo,
    pageSize: 100,
  });

  useEffect(() => {
    if (!loading) setCalendarReady(true);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    async function loadLookups() {
      if (!myMembershipId) return;

      try {
        const taskParams = new URLSearchParams({
          pageSize: '100',
          assigneeId: myMembershipId,
        });
        const tasksRes = await api<Paginated<Task>>(
          `/tasks?${taskParams.toString()}`,
        );
        if (!cancelled) {
          setTasks(
            (tasksRes.data ?? []).filter(
              (t) => t.assigneeId === myMembershipId,
            ),
          );
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

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

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
      reload();
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
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update entry'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEventMove(
    entry: TimeEntry,
    next: { entryDate: string; startTime: string; endTime: string | null },
  ) {
    const body: UpdateTimeEntryInput = {
      entryDate: next.entryDate,
      startTime: next.startTime,
      endTime: next.endTime,
    };
    try {
      await api(`/time-entries/${entry.id}`, { method: 'PATCH', body });
      toast.success('Time updated');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not move entry'));
      throw err;
    }
  }

  function handleEventClick(entry: TimeEntry) {
    if (
      entry.status === 'submitted' ||
      entry.status === 'approved' ||
      entry.status === 'locked'
    ) {
      toast.push(
        `This entry is ${entry.status} and read-only. Grey blocks cannot be edited.`,
        'info',
      );
      return;
    }
    if (!canMutateTime) {
      toast.error('You cannot edit time right now');
      return;
    }
    setModal({ type: 'edit-entry', entry });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Calendar"
        description="Overview of logged and locked time. Drag a range to add an entry (not future dates). Submit from Timesheet."
      />

      {error && !calendarReady ? (
        <div className="rounded-lg border border-border/80 bg-card px-5 py-6">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={reload}
          >
            Try again
          </Button>
        </div>
      ) : !calendarReady ? (
        <ListSkeleton rows={6} />
      ) : (
        <TimeCalendar
          entries={entries}
          projectsById={projectsById}
          tasksById={tasksById}
          canEdit={canMutateTime}
          onDatesSet={({ from, to }) => {
            // Fetch window only — do not push `from` back as calendar date.
            setRangeFrom(from);
            setRangeTo(to);
          }}
          onSelectCreate={(range) => {
            if (!canMutateTime) return;
            const today = toDateParam(new Date());
            if (range.entryDate > today) {
              toast.error('Cannot log time for a future date');
              return;
            }
            setModal({ type: 'create', range });
          }}
          onEventClick={handleEventClick}
          onEventMove={handleEventMove}
        />
      )}

      <Modal
        open={modal?.type === 'create'}
        title="New time block"
        description="Pick an assigned task for the range you dragged on the calendar."
        onClose={() => !submitting && setModal(null)}
      >
        {modal?.type === 'create' ? (
          <AddTimeForm
            tasks={tasks}
            projects={projects}
            defaultDate={modal.range.entryDate}
            defaultRange={{
              startTime: modal.range.startTime,
              endTime: modal.range.endTime,
            }}
            submitting={submitting}
            submitLabel="Create entry"
            onSubmit={handleAddTimeSubmit}
            onCancel={() => setModal(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={modal?.type === 'edit-entry'}
        title="Edit entry"
        description="Update task, time, and note. Locked weeks cannot be changed."
        onClose={() => !submitting && setModal(null)}
      >
        {modal?.type === 'edit-entry' ? (
          <AddTimeForm
            tasks={tasks}
            projects={projects}
            initialEntry={modal.entry}
            submitting={submitting}
            submitLabel="Save entry"
            onSubmit={handleEditEntrySubmit}
            onCancel={() => setModal(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}
