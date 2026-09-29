'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { Project, Task, TimeEntry } from '@/types/api';

export type TimesheetMode = 'day' | 'week';

type TimesheetPanelProps = {
  mode: TimesheetMode;
  tasks: Task[];
  projectsById: Map<string, Project>;
  entries: TimeEntry[];
  canEdit: boolean;
  timerBusy?: boolean;
  runningTaskId?: string | null;
  onAddTime: (taskId?: string, entryDate?: string) => void;
  onEditEntry: (entry: TimeEntry) => void;
  onDeleteEntry: (entry: TimeEntry) => void;
  onStartTimer: (taskId: string) => void;
  defaultEntryDate: string;
};

type TaskGroup = {
  taskId: string | null;
  taskName: string;
  projectName: string;
  entries: TimeEntry[];
  totalMinutes: number;
};

function entryMinutes(entry: TimeEntry): number {
  return (entry.timeLines ?? []).reduce(
    (sum, line) => sum + (line.durationMinutes ?? 0),
    0,
  );
}

function primaryTaskId(entry: TimeEntry): string | null {
  const lines = entry.timeLines ?? [];
  const first = lines.find((l) => l.isFirstLine) ?? lines[0];
  return first?.taskId ?? null;
}

function formatClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: string) {
  if (status === 'approved') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  if (status === 'submitted' || status === 'locked') return 'warning' as const;
  return 'neutral' as const;
}

function isLocked(entry: TimeEntry) {
  return (
    entry.status === 'submitted' ||
    entry.status === 'approved' ||
    entry.status === 'locked'
  );
}

/**
 * Day/Week submission sheet: tasks with nested time entries and lines.
 */
export function TimesheetPanel({
  mode,
  tasks,
  projectsById,
  entries,
  canEdit,
  timerBusy = false,
  runningTaskId = null,
  onAddTime,
  onEditEntry,
  onDeleteEntry,
  onStartTimer,
  defaultEntryDate,
}: TimesheetPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const byTask = new Map<string, TaskGroup>();

    for (const task of tasks) {
      const projectName =
        task.project?.name ||
        (task.projectId ? projectsById.get(task.projectId)?.name : null) ||
        '—';
      byTask.set(task.id, {
        taskId: task.id,
        taskName: task.name,
        projectName,
        entries: [],
        totalMinutes: 0,
      });
    }

    const unassigned: TaskGroup = {
      taskId: null,
      taskName: 'Unassigned',
      projectName: 'No task',
      entries: [],
      totalMinutes: 0,
    };

    for (const entry of entries) {
      const taskId = primaryTaskId(entry);
      const mins = entryMinutes(entry);
      if (taskId && byTask.has(taskId)) {
        const g = byTask.get(taskId)!;
        g.entries.push(entry);
        g.totalMinutes += mins;
      } else if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        const key = taskId;
        let g = byTask.get(key);
        if (!g) {
          g = {
            taskId,
            taskName: task?.name ?? 'Task',
            projectName:
              task?.project?.name ||
              (task?.projectId
                ? projectsById.get(task.projectId)?.name
                : null) ||
              '—',
            entries: [],
            totalMinutes: 0,
          };
          byTask.set(key, g);
        }
        g.entries.push(entry);
        g.totalMinutes += mins;
      } else {
        unassigned.entries.push(entry);
        unassigned.totalMinutes += mins;
      }
    }

    const list = [...byTask.values()].sort((a, b) => {
      if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
      return a.taskName.localeCompare(b.taskName);
    });
    if (unassigned.entries.length > 0) list.push(unassigned);
    return list;
  }, [tasks, projectsById, entries]);

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (tasks.length === 0 && entries.length === 0) {
    return (
      <div className="rounded-lg border border-border/80 bg-card px-5 py-6">
        <p className="text-sm font-medium text-ink">No assigned tasks</p>
        <p className="mt-1 text-sm text-slate">
          Ask your manager to assign a task before logging time.
        </p>
      </div>
    );
  }

  const periodLabel = mode === 'day' ? 'today' : 'this week';

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const key = group.taskId ?? 'unassigned';
        const open = expanded[key] ?? group.totalMinutes > 0;
        const hasEntries = group.entries.length > 0;

        return (
          <section
            key={key}
            className="overflow-hidden rounded-lg border border-border/80 bg-card"
          >
            <button
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{group.taskName}</p>
                <p className="truncate text-xs text-slate">
                  {group.projectName}
                  {hasEntries
                    ? ` · ${group.entries.length} entr${group.entries.length === 1 ? 'y' : 'ies'}`
                    : ` · No time ${periodLabel}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="tabular-nums text-sm font-medium text-ink">
                  {group.totalMinutes > 0
                    ? formatHoursMinutes(group.totalMinutes)
                    : '—'}
                </span>
                <span className="text-xs text-slate">{open ? 'Hide' : 'Show'}</span>
              </div>
            </button>

            {open ? (
              <div className="space-y-3 border-t border-border/60 px-4 py-3 sm:px-5">
                {group.entries.length === 0 ? (
                  <p className="text-sm text-slate">
                    No entries for {periodLabel} yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {group.entries.map((entry) => {
                      const lines = entry.timeLines ?? [];
                      const locked = isLocked(entry);
                      const start = formatClock(entry.startTime);
                      const end = formatClock(entry.endTime);
                      const note =
                        lines.find((l) => l.isFirstLine)?.description ||
                        lines[0]?.description;
                      const dateLabel = entry.entryDate.slice(0, 10);

                      return (
                        <li key={entry.id} className="py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-ink">
                                  {mode === 'week' ? dateLabel : 'Today'}
                                </span>
                                <Badge variant={statusVariant(entry.status)}>
                                  {entry.status}
                                </Badge>
                                {entry.endTime === null &&
                                entry.source === 'timer' ? (
                                  <Badge variant="coral">Running</Badge>
                                ) : null}
                              </div>
                              <p className="text-sm text-slate">
                                {start && end
                                  ? `${start} – ${end}`
                                  : formatHoursMinutes(entryMinutes(entry))}
                                {note ? ` · ${note}` : ''}
                              </p>
                              {lines.length > 1 ? (
                                <ul className="mt-1 space-y-0.5 pl-3 text-xs text-slate">
                                  {lines.map((line) => (
                                    <li key={line.id}>
                                      {formatHoursMinutes(line.durationMinutes)}
                                      {line.description
                                        ? ` — ${line.description}`
                                        : ''}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                            {canEdit && !locked ? (
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEditEntry(entry)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-danger hover:text-danger"
                                  onClick={() => onDeleteEntry(entry)}
                                >
                                  Delete
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canEdit && group.taskId ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        onAddTime(group.taskId ?? undefined, defaultEntryDate)
                      }
                    >
                      Add time
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={timerBusy || Boolean(runningTaskId)}
                      onClick={() => onStartTimer(group.taskId!)}
                    >
                      {runningTaskId === group.taskId ? 'Running' : 'Start timer'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
