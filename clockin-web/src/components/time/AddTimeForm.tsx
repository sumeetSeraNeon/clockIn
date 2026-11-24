'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toDateParam } from '@/lib/date-range';
import { suggestNextRange } from '@/lib/day-hour-slots';
import {
  clockFromWallIso,
  wallIsoFromDateAndClock,
} from '@/lib/wall-clock';
import {
  DAILY_CAP_MINUTES,
  clientIdForProject,
  clientsFromProjects,
  dayLoggedMinutes,
  projectIdForTask,
  projectsForClient,
  projectsScopedToTasks,
} from '@/lib/task-project-picker';
import { clientLabel } from '@/lib/client-label';
import { formatHoursMinutes } from '@/lib/format-duration';
import { TaskSearchSelect } from '@/components/time/TaskSearchSelect';
import { TicketOptionalSelect } from '@/components/time/TicketOptionalSelect';
import { entryTicketInfo } from '@/lib/entry-display';
import { ticketTypeDisplay } from '@/lib/ticket-options';
import type { Project, Task, TimeEntry } from '@/types/api';
import {
  findOverlappingEntry,
  overlapErrorMessage,
} from '@/lib/time-overlap';

export type AddTimeValues = {
  taskId: string;
  /** Required for create when task is omitted (ticket-only). */
  projectId: string;
  clientId: string;
  /** Optional ticket on the time line (FIX 1). Empty = none. */
  ticketId: string;
  entryDate: string;
  description: string;
  /** Always range (start/end). Kept for call-site compatibility. */
  mode: 'range';
  durationHours: string;
  durationMinutes: string;
  startTime: string;
  endTime: string;
};

type AddTimeFormProps = {
  tasks: Task[];
  /** Optional lookup for project names when tasks omit nested project */
  projects?: Project[];
  submitting: boolean;
  /** Prefill task (e.g. from Tasks → Track). */
  defaultTaskId?: string;
  /** Prefill project (e.g. from Tickets → Track). */
  defaultProjectId?: string;
  /** Prefill client (e.g. from Tickets → Track). */
  defaultClientId?: string;
  /** Prefill ticket (e.g. from Tickets → Track). */
  defaultTicketId?: string;
  defaultDate?: string;
  /** Prefill start/end from calendar drag (ISO). Forces range mode. */
  defaultRange?: { startTime: string; endTime: string } | null;
  /** Edit existing Level-1 entry (first line only). */
  initialEntry?: TimeEntry | null;
  /** FIX 2 — other entries for overlap checks (same user/day). */
  existingEntries?: TimeEntry[];
  submitLabel?: string;
  /** Hide Cancel (inline strip on timesheet). */
  hideCancel?: boolean;
  onSubmit: (values: AddTimeValues) => Promise<void>;
  onCancel?: () => void;
};

function partsFromMinutes(total: number) {
  const safe = Math.max(0, total);
  return {
    durationHours: String(Math.floor(safe / 60)),
    durationMinutes: String(safe % 60),
  };
}

function clockFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  return clockFromWallIso(iso) ?? '';
}

/**
 * Client → Project → Task cascade, then times → description → save.
 * Defaults to start/end range for new entries.
 */
export function AddTimeForm({
  tasks,
  projects = [],
  submitting,
  defaultTaskId = '',
  defaultProjectId = '',
  defaultClientId = '',
  defaultTicketId = '',
  defaultDate,
  defaultRange = null,
  initialEntry = null,
  existingEntries = [],
  submitLabel = 'Save entry',
  hideCancel = false,
  onSubmit,
  onCancel,
}: AddTimeFormProps) {
  const firstLine = initialEntry?.timeLines?.[0];

  const [clientId, setClientId] = useState(defaultClientId);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [taskId, setTaskId] = useState(defaultTaskId);
  const [ticketId, setTicketId] = useState(defaultTicketId);
  const [entryDate, setEntryDate] = useState(
    defaultDate ?? toDateParam(new Date()),
  );
  const [description, setDescription] = useState('');
  const initialSuggest = suggestNextRange(
    existingEntries,
    defaultDate ?? toDateParam(new Date()),
  );
  const [startTime, setStartTime] = useState(initialSuggest.startTime);
  const [endTime, setEndTime] = useState(initialSuggest.endTime);
  const [error, setError] = useState<string | null>(null);

  function clockFromRangeValue(value: string): string {
    if (value.includes('T')) return clockFromIso(value) || value.slice(0, 5);
    return value.slice(0, 5);
  }

  const scopedProjects = useMemo(() => {
    const base = projectsScopedToTasks(tasks, projects);
    const ensureIds = [
      defaultProjectId,
      firstLine?.projectId ?? '',
    ].filter(Boolean);
    let next = base;
    for (const id of ensureIds) {
      if (next.some((p) => p.id === id)) continue;
      const extra = projects.find((p) => p.id === id);
      if (extra) next = [...next, extra];
    }
    return next;
  }, [tasks, projects, defaultProjectId, firstLine?.projectId]);
  const clientOptions = useMemo(
    () => clientsFromProjects(scopedProjects),
    [scopedProjects],
  );
  const projectOptions = useMemo(
    () => projectsForClient(scopedProjects, clientId),
    [scopedProjects, clientId],
  );
  const selectedTaskLabel = useMemo(
    () => tasks.find((t) => t.id === taskId)?.name ?? null,
    [tasks, taskId],
  );

  const selectedTicketLabel = useMemo(() => {
    if (!ticketId || firstLine?.ticketId !== ticketId) return null;
    if (firstLine.ticket?.reference) {
      const type = ticketTypeDisplay(
        firstLine.ticket.ticketType ?? firstLine.ticketType,
      );
      return type
        ? `${firstLine.ticket.reference} (${type})`
        : firstLine.ticket.reference;
    }
    const info = initialEntry ? entryTicketInfo(initialEntry) : null;
    if (!info) return null;
    const type = info.typeLabel || ticketTypeDisplay(info.ticketType);
    return type ? `${info.reference} (${type})` : info.reference;
  }, [ticketId, firstLine, initialEntry]);

  useEffect(() => {
    if (initialEntry && firstLine) {
      const day = initialEntry.entryDate
        ? initialEntry.entryDate.slice(0, 10)
        : toDateParam(new Date());
      const tid = firstLine.taskId ?? '';
      const pid =
        projectIdForTask(tasks, tid) ||
        firstLine.projectId ||
        defaultProjectId ||
        '';
      setTaskId(tid);
      setProjectId(pid);
      setClientId(clientIdForProject(scopedProjects, pid));
      setTicketId(firstLine.ticketId ?? '');
      setEntryDate(day);
      setDescription(firstLine.description ?? '');
      if (initialEntry.startTime && initialEntry.endTime) {
        setStartTime(clockFromIso(initialEntry.startTime) || '09:00');
        setEndTime(clockFromIso(initialEntry.endTime) || '10:00');
      } else {
        const suggested = suggestNextRange(existingEntries, day);
        setStartTime(suggested.startTime);
        setEndTime(suggested.endTime);
      }
    } else {
      // Order: client → project → task → ticket (so ticket select keeps its value).
      const tid = defaultTaskId;
      const pid =
        projectIdForTask(tasks, tid) || defaultProjectId || '';
      const cid =
        defaultClientId ||
        clientIdForProject(scopedProjects, pid) ||
        '';
      setClientId(cid);
      setProjectId(pid);
      setTaskId(tid);
      setTicketId(defaultTicketId);
      setEntryDate(defaultDate ?? toDateParam(new Date()));
      setDescription('');
      if (defaultRange?.startTime && defaultRange?.endTime) {
        const startClock = clockFromRangeValue(defaultRange.startTime);
        const endClock = clockFromRangeValue(defaultRange.endTime);
        setStartTime(startClock);
        setEndTime(endClock);
      } else {
        const suggested = suggestNextRange(
          existingEntries,
          defaultDate ?? toDateParam(new Date()),
        );
        setStartTime(suggested.startTime);
        setEndTime(suggested.endTime);
      }
    }
  }, [
    initialEntry,
    firstLine,
    defaultTaskId,
    defaultProjectId,
    defaultClientId,
    defaultTicketId,
    defaultDate,
    defaultRange,
    existingEntries,
    tasks,
    scopedProjects,
  ]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId) {
      setError('Pick a client.');
      return;
    }
    if (!projectId) {
      setError('Pick a project.');
      return;
    }
    if (!taskId && !ticketId) {
      setError('Pick a task, or select a ticket to log without a task.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Start and end time are required.');
      return;
    }
    const start = new Date(`${entryDate}T${startTime}:00`);
    const end = new Date(`${entryDate}T${endTime}:00`);
    if (!(end > start)) {
      setError('End time must be after start time.');
      return;
    }
    const today = toDateParam(new Date());
    if (entryDate > today) {
      setError('Cannot log time for a future date.');
      return;
    }

    const mins = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 60_000),
    );
    const parts = partsFromMinutes(mins);
    const draftValues: AddTimeValues = {
      taskId,
      projectId,
      clientId,
      ticketId,
      entryDate,
      description,
      mode: 'range',
      durationHours: parts.durationHours,
      durationMinutes: parts.durationMinutes,
      startTime,
      endTime,
    };
    const range = isoRangeFromAddValues(draftValues);
    if (range.startTime && range.endTime) {
      const dayEntries = existingEntries.filter(
        (e) => e.entryDate.slice(0, 10) === entryDate.slice(0, 10),
      );
      const clash = findOverlappingEntry(
        dayEntries,
        new Date(range.startTime),
        new Date(range.endTime),
        initialEntry?.id,
      );
      if (clash) {
        setError(overlapErrorMessage(clash));
        return;
      }
    }

    const addMinutes = durationMinutesFromAddValues(draftValues);
    if (addMinutes < 1) {
      setError('End time must be at least 1 minute after start.');
      return;
    }
    const already = dayLoggedMinutes(
      existingEntries,
      entryDate,
      initialEntry?.id,
    );
    if (already + addMinutes > DAILY_CAP_MINUTES) {
      const remaining = Math.max(0, DAILY_CAP_MINUTES - already);
      setError(
        `This would exceed the 8h daily limit. ${formatHoursMinutes(already)} already logged today; ${formatHoursMinutes(remaining)} remaining.`,
      );
      return;
    }

    setError(null);
    await onSubmit(draftValues);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {/* Tab order: client → project → task → ticket → times → description → save */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Client" htmlFor="add-time-client" required>
          <Select
            id="add-time-client"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setProjectId('');
              setTaskId('');
              setTicketId('');
            }}
            disabled={submitting}
          >
            <option value="">Select client…</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {clientLabel(c)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Project" htmlFor="add-time-project" required>
          <Select
            id="add-time-project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setTaskId('');
              setTicketId('');
            }}
            disabled={submitting || !clientId}
          >
            <option value="">
              {!clientId ? 'Select a client first' : 'Select project…'}
            </option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </FormField>

        <TaskSearchSelect
          id="add-time-task"
          projectId={projectId}
          value={taskId}
          onChange={setTaskId}
          disabled={submitting}
          selectedLabel={selectedTaskLabel}
          required={false}
        />

        <TicketOptionalSelect
          id="add-time-ticket"
          projectId={projectId}
          value={ticketId}
          onChange={setTicketId}
          disabled={submitting}
          selectedLabel={selectedTicketLabel}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          label="Date"
          htmlFor="add-time-date"
          hint="Defaults to today"
          required
        >
          <Input
            id="add-time-date"
            type="date"
            value={entryDate}
            max={toDateParam(new Date())}
            onChange={(e) => setEntryDate(e.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField label="Start" htmlFor="add-time-start" required>
          <Input
            id="add-time-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={submitting}
            required
          />
        </FormField>
        <FormField label="End" htmlFor="add-time-end" required>
          <Input
            id="add-time-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={submitting}
            required
          />
        </FormField>
      </div>

      <FormField label="What did you do?" htmlFor="add-time-note">
        <Input
          id="add-time-note"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short note"
          disabled={submitting}
        />
      </FormField>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        {!hideCancel && onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={submitting} disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function durationMinutesFromAddValues(values: AddTimeValues): number {
  const start = new Date(`${values.entryDate}T${values.startTime}:00`);
  const end = new Date(`${values.entryDate}T${values.endTime}:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
}

export function isoRangeFromAddValues(values: AddTimeValues): {
  startTime?: string;
  endTime?: string | null;
} {
  return {
    startTime: wallIsoFromDateAndClock(values.entryDate, values.startTime),
    endTime: wallIsoFromDateAndClock(values.entryDate, values.endTime),
  };
}
