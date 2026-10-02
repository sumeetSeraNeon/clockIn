import { formatHoursMinutes } from '@/lib/format-duration';
import type { TimeEntry } from '@/types/api';

/** Shared entry display helpers (FIX 4 — Timesheet + Calendar consistency). */

export function entryDurationMinutes(entry: TimeEntry): number {
  return (entry.timeLines ?? []).reduce(
    (sum, line) => sum + (line.durationMinutes ?? 0),
    0,
  );
}

export function entryDescription(entry: TimeEntry): string | null {
  const lines = entry.timeLines ?? [];
  const first = lines.find((l) => l.isFirstLine) ?? lines[0];
  const note = first?.description?.trim();
  return note || null;
}

export function isEntryRunning(entry: TimeEntry): boolean {
  return entry.endTime === null && entry.source === 'timer';
}

export function isEntryLocked(entry: TimeEntry): boolean {
  return (
    entry.status === 'submitted' ||
    entry.status === 'approved' ||
    entry.status === 'locked'
  );
}

export function formatEntryClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** e.g. "9:00 AM – 10:30 AM · 1h 30m" or "Running" or "1h 30m" */
export function formatEntryTimeLabel(entry: TimeEntry): string {
  if (isEntryRunning(entry)) return 'Running';
  const mins = entryDurationMinutes(entry);
  const start = formatEntryClock(entry.startTime);
  const end = formatEntryClock(entry.endTime);
  if (start && end) {
    return `${start} – ${end} · ${formatHoursMinutes(mins)}`;
  }
  return formatHoursMinutes(mins);
}

/** Human status tags for locked / draft rows */
export function entryStatusLabel(status: string, running = false): string {
  if (running) return 'Running';
  if (status === 'submitted') return 'Submitted';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'locked') return 'Locked';
  if (status === 'draft') return 'Draft';
  return status;
}

export function entryStatusVariant(
  status: string,
): 'success' | 'danger' | 'warning' | 'neutral' | 'coral' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'submitted' || status === 'locked') return 'warning';
  return 'neutral';
}

/** Calendar event title — task + note, same wording as Timesheet secondary line */
export function formatEntryCalendarTitle(
  entry: TimeEntry,
  taskName?: string | null,
  projectName?: string | null,
): string {
  if (isEntryRunning(entry)) {
    return taskName ? `${taskName} · Running` : 'Timer running';
  }
  const note = entryDescription(entry);
  if (taskName && note) return `${taskName}: ${note}`;
  if (taskName) return taskName;
  if (note) return note;
  if (projectName) return projectName;
  return formatEntryTimeLabel(entry);
}
