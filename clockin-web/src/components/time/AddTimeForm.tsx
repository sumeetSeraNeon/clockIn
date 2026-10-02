'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toDateParam } from '@/lib/date-range';
import {
  projectIdForTask,
  projectsFromTasks,
  tasksForProject,
} from '@/lib/task-project-picker';
import type { Project, Task, TimeEntry } from '@/types/api';
import {
  findOverlappingEntry,
  overlapErrorMessage,
} from '@/lib/time-overlap';

export type AddTimeValues = {
  taskId: string;
  entryDate: string;
  description: string;
  /** duration | range */
  mode: 'duration' | 'range';
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
  defaultDate?: string;
  /** Prefill start/end from calendar drag (ISO). Forces range mode. */
  defaultRange?: { startTime: string; endTime: string } | null;
  /** Edit existing Level-1 entry (first line only). */
  initialEntry?: TimeEntry | null;
  /** FIX 2 — other entries for overlap checks (same user/day). */
  existingEntries?: TimeEntry[];
  submitLabel?: string;
  onSubmit: (values: AddTimeValues) => Promise<void>;
  onCancel: () => void;
};

function minutesFromParts(hours: string, minutes: string): number {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return Math.max(0, Math.round(h * 60 + m));
}

function partsFromMinutes(total: number) {
  const safe = Math.max(0, total);
  return {
    durationHours: String(Math.floor(safe / 60)),
    durationMinutes: String(safe % 60),
  };
}

function clockFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * FIX 4 — keyboard path: project → task → start → end → description → save.
 * Defaults to start/end range for new entries.
 */
export function AddTimeForm({
  tasks,
  projects = [],
  submitting,
  defaultTaskId = '',
  defaultDate,
  defaultRange = null,
  initialEntry = null,
  existingEntries = [],
  submitLabel = 'Save entry',
  onSubmit,
  onCancel,
}: AddTimeFormProps) {
  const firstLine = initialEntry?.timeLines?.[0];

  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState(defaultTaskId);
  const [entryDate, setEntryDate] = useState(
    defaultDate ?? toDateParam(new Date()),
  );
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'duration' | 'range'>('range');
  const [durationHours, setDurationHours] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [error, setError] = useState<string | null>(null);

  const projectOptions = useMemo(
    () => projectsFromTasks(tasks, projects),
    [tasks, projects],
  );
  const taskOptions = useMemo(
    () => tasksForProject(tasks, projectId),
    [tasks, projectId],
  );

  useEffect(() => {
    if (initialEntry && firstLine) {
      const parts = partsFromMinutes(firstLine.durationMinutes ?? 0);
      const hasRange = Boolean(initialEntry.startTime && initialEntry.endTime);
      const tid = firstLine.taskId ?? '';
      setTaskId(tid);
      setProjectId(projectIdForTask(tasks, tid));
      setEntryDate(
        initialEntry.entryDate
          ? initialEntry.entryDate.slice(0, 10)
          : toDateParam(new Date()),
      );
      setDescription(firstLine.description ?? '');
      setMode(hasRange ? 'range' : 'duration');
      setDurationHours(parts.durationHours);
      setDurationMinutes(parts.durationMinutes);
      setStartTime(clockFromIso(initialEntry.startTime) || '09:00');
      setEndTime(clockFromIso(initialEntry.endTime) || '10:00');
    } else {
      const tid = defaultTaskId;
      setTaskId(tid);
      setProjectId(projectIdForTask(tasks, tid));
      setEntryDate(defaultDate ?? toDateParam(new Date()));
      setDescription('');
      if (defaultRange?.startTime && defaultRange?.endTime) {
        const start = new Date(defaultRange.startTime);
        const end = new Date(defaultRange.endTime);
        const mins = Math.max(
          1,
          Math.round((end.getTime() - start.getTime()) / 60_000),
        );
        const parts = partsFromMinutes(mins);
        setMode('range');
        setStartTime(clockFromIso(defaultRange.startTime) || '09:00');
        setEndTime(clockFromIso(defaultRange.endTime) || '10:00');
        setDurationHours(parts.durationHours);
        setDurationMinutes(parts.durationMinutes);
      } else {
        // FIX 4 — new entries default to start/end for keyboard flow
        setMode('range');
        setDurationHours('1');
        setDurationMinutes('0');
        setStartTime('09:00');
        setEndTime('10:00');
      }
    }
  }, [initialEntry, firstLine, defaultTaskId, defaultDate, defaultRange, tasks]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!projectId) {
      setError('Pick a project.');
      return;
    }
    if (!taskId) {
      setError('Pick a task.');
      return;
    }
    if (mode === 'duration') {
      const mins = minutesFromParts(durationHours, durationMinutes);
      if (mins < 1) {
        setError('Duration must be at least 1 minute.');
        return;
      }
    } else {
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
    }
    const today = toDateParam(new Date());
    if (entryDate > today) {
      setError('Cannot log time for a future date.');
      return;
    }

    const draftValues: AddTimeValues = {
      taskId,
      entryDate,
      description,
      mode,
      durationHours,
      durationMinutes,
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

    setError(null);
    await onSubmit(draftValues);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {/* Tab order: project → task → start → end → description → save */}
      <FormField label="Project" htmlFor="add-time-project">
        <Select
          id="add-time-project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId('');
          }}
          disabled={submitting}
        >
          <option value="">Select project…</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Task" htmlFor="add-time-task">
        <Select
          id="add-time-task"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          disabled={submitting || !projectId}
        >
          <option value="">
            {!projectId ? 'Select a project first' : 'Select task…'}
          </option>
          {taskOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2 text-slate">
          <input
            type="radio"
            name="add-time-mode"
            checked={mode === 'range'}
            onChange={() => setMode('range')}
            disabled={submitting}
          />
          Start / end
        </label>
        <label className="flex items-center gap-2 text-slate">
          <input
            type="radio"
            name="add-time-mode"
            checked={mode === 'duration'}
            onChange={() => setMode('duration')}
            disabled={submitting}
          />
          Duration
        </label>
      </div>

      {mode === 'range' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Start" htmlFor="add-time-start">
            <Input
              id="add-time-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={submitting}
              required
            />
          </FormField>
          <FormField label="End" htmlFor="add-time-end">
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Hours" htmlFor="add-time-hours">
            <Input
              id="add-time-hours"
              type="number"
              min={0}
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              disabled={submitting}
            />
          </FormField>
          <FormField label="Minutes" htmlFor="add-time-mins">
            <Input
              id="add-time-mins"
              type="number"
              min={0}
              max={59}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              disabled={submitting}
            />
          </FormField>
        </div>
      )}

      <FormField label="What did you do?" htmlFor="add-time-note">
        <Input
          id="add-time-note"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short note"
          disabled={submitting}
        />
      </FormField>

      <FormField label="Date" htmlFor="add-time-date" hint="Defaults to today">
        <Input
          id="add-time-date"
          type="date"
          value={entryDate}
          max={toDateParam(new Date())}
          onChange={(e) => setEntryDate(e.target.value)}
          disabled={submitting}
        />
      </FormField>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function durationMinutesFromAddValues(values: AddTimeValues): number {
  if (values.mode === 'duration') {
    return minutesFromParts(values.durationHours, values.durationMinutes);
  }
  const start = new Date(`${values.entryDate}T${values.startTime}:00`);
  const end = new Date(`${values.entryDate}T${values.endTime}:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
}

export function isoRangeFromAddValues(values: AddTimeValues): {
  startTime?: string;
  endTime?: string | null;
} {
  if (values.mode === 'range') {
    return {
      startTime: new Date(
        `${values.entryDate}T${values.startTime}:00`,
      ).toISOString(),
      endTime: new Date(`${values.entryDate}T${values.endTime}:00`).toISOString(),
    };
  }
  const mins = durationMinutesFromAddValues(values);
  const start = new Date(`${values.entryDate}T09:00:00`);
  const end = new Date(start.getTime() + mins * 60_000);
  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}
