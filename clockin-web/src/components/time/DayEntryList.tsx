'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { Task, TimeEntry } from '@/types/api';

type DayEntryListProps = {
  entries: TimeEntry[];
  tasksById: Map<string, Task>;
  canEdit: boolean;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
  onAdd: () => void;
};

function entryMinutes(entry: TimeEntry): number {
  return (entry.timeLines ?? []).reduce(
    (sum, line) => sum + (line.durationMinutes ?? 0),
    0,
  );
}

function formatClock(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * FINAL FIX 2 — simple day list (Level 1: one row per entry, not multi-line expand).
 */
export function DayEntryList({
  entries,
  tasksById,
  canEdit,
  onEdit,
  onDelete,
  onAdd,
}: DayEntryListProps) {
  const dayTotal = useMemo(
    () => entries.reduce((sum, e) => sum + entryMinutes(e), 0),
    [entries],
  );

  // Newest first; keep running timer at top
  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aRun =
        a.endTime === null && a.source === 'timer' ? 0 : 1;
      const bRun =
        b.endTime === null && b.source === 'timer' ? 0 : 1;
      if (aRun !== bRun) return aRun - bRun;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [entries]);

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-card px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Today&apos;s entries</h2>
          <p className="text-sm text-slate">
            {entries.length === 0
              ? 'No entries yet — add time or use the timer.'
              : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · ${formatHoursMinutes(dayTotal)}`}
          </p>
        </div>
        {canEdit ? (
          <Button type="button" onClick={onAdd}>
            Add time
          </Button>
        ) : null}
      </div>

      {sorted.length === 0 ? null : (
        <ul className="divide-y divide-border/80">
          {sorted.map((entry) => {
            const line = entry.timeLines?.[0];
            const task = line?.taskId ? tasksById.get(line.taskId) : undefined;
            const running =
              entry.endTime === null && entry.source === 'timer';
            const locked =
              entry.status === 'submitted' ||
              entry.status === 'approved' ||
              entry.status === 'locked';
            const start = formatClock(entry.startTime);
            const end = formatClock(entry.endTime);
            const timeLabel =
              running
                ? 'Running'
                : start && end
                  ? `${start} – ${end}`
                  : formatHoursMinutes(entryMinutes(entry));

            return (
              <li
                key={entry.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-ink">
                      {task?.name ?? 'No task'}
                    </p>
                    {running ? <Badge variant="coral">Timer</Badge> : null}
                    {locked ? <Badge variant="neutral">{entry.status}</Badge> : null}
                  </div>
                  {task?.project?.name ? (
                    <p className="truncate text-xs text-slate">
                      {task.project.name}
                      {task.project.owner?.user?.name ||
                      task.project.owner?.user?.email
                        ? ` · ${
                            task.project.owner.user.name ||
                            task.project.owner.user.email
                          }`
                        : ''}
                    </p>
                  ) : null}
                  <p className="text-sm tabular-nums text-slate">{timeLabel}</p>
                  {line?.description ? (
                    <p className="truncate text-sm text-slate">
                      {line.description}
                    </p>
                  ) : null}
                </div>
                {canEdit && !locked && !running ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(entry)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger"
                      onClick={() => onDelete(entry)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
