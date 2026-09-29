'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toDateParam } from '@/lib/date-range';
import type { Task, TimeEntry } from '@/types/api';

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
  submitting: boolean;
  /** Prefill task (e.g. from Tasks → Track). */
  defaultTaskId?: string;
  defaultDate?: string;
  /** Prefill start/end from calendar drag (ISO). Forces range mode. */
  defaultRange?: { startTime: string; endTime: string } | null;
  /** Edit existing Level-1 entry (first line only). */
  initialEntry?: TimeEntry | null;
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
 * FINAL FIX 2 — Level 1 manual time: one entry = one block (task, date, duration or range, note).
 */
export function AddTimeForm({
  tasks,
  submitting,
  defaultTaskId = '',
  defaultDate,
  defaultRange = null,
  initialEntry = null,
  submitLabel = 'Save entry',
  onSubmit,
  onCancel,
}: AddTimeFormProps) {
  const isEdit = Boolean(initialEntry);
  const firstLine = initialEntry?.timeLines?.[0];

  const [taskId, setTaskId] = useState(defaultTaskId);
  const [entryDate, setEntryDate] = useState(
    defaultDate ?? toDateParam(new Date()),
  );
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'duration' | 'range'>('duration');
  const [durationHours, setDurationHours] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEntry && firstLine) {
      const parts = partsFromMinutes(firstLine.durationMinutes ?? 0);
      const hasRange = Boolean(initialEntry.startTime && initialEntry.endTime);
      setTaskId(firstLine.taskId ?? '');
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
      setTaskId(defaultTaskId);
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
        setMode('duration');
        setDurationHours('1');
        setDurationMinutes('0');
        setStartTime('09:00');
        setEndTime('10:00');
      }
    }
  }, [initialEntry, firstLine, defaultTaskId, defaultDate, defaultRange]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!taskId) {
      setError('Pick an assigned task.');
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
    setError(null);
    await onSubmit({
      taskId,
      entryDate,
      description,
      mode,
      durationHours,
      durationMinutes,
      startTime,
      endTime,
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <FormField label="Task" htmlFor="add-time-task">
        <Select
          id="add-time-task"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          disabled={submitting || (isEdit && false)}
        >
          <option value="">Select task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.project?.name ? `${t.name} · ${t.project.name}` : t.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Date" htmlFor="add-time-date">
        <Input
          id="add-time-date"
          type="date"
          value={entryDate}
          max={toDateParam(new Date())}
          onChange={(e) => setEntryDate(e.target.value)}
          disabled={submitting}
        />
      </FormField>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">How long?</legend>
        <div className="flex flex-wrap gap-3 text-sm">
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
        </div>

        {mode === 'duration' ? (
          <div className="flex gap-3">
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
        ) : (
          <div className="flex gap-3">
            <FormField label="Start" htmlFor="add-time-start">
              <Input
                id="add-time-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={submitting}
              />
            </FormField>
            <FormField label="End" htmlFor="add-time-end">
              <Input
                id="add-time-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={submitting}
              />
            </FormField>
          </div>
        )}
      </fieldset>

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

/** Build create/update payloads from AddTimeValues (shared by Time + Tasks Track). */
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
  // Duration mode: closed range (never endTime null — that means a running timer)
  const mins = durationMinutesFromAddValues(values);
  const start = new Date(`${values.entryDate}T09:00:00`);
  const end = new Date(start.getTime() + mins * 60_000);
  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}
