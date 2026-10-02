'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  entryDescription,
  entryDurationMinutes,
  entryStatusLabel,
  entryStatusVariant,
  formatEntryTimeLabel,
  isEntryLocked,
  isEntryRunning,
} from '@/lib/entry-display';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { Project, Task, TimeEntry } from '@/types/api';

export type TimesheetMode = 'day' | 'week';

type TimesheetPanelProps = {
  mode: TimesheetMode;
  tasks: Task[];
  projectsById: Map<string, Project>;
  entries: TimeEntry[];
  canEdit: boolean;
  canSubmit?: boolean;
  submittingTaskId?: string | null;
  timerBusy?: boolean;
  runningTaskId?: string | null;
  onAddTime: (taskId?: string, entryDate?: string) => void;
  onEditEntry: (entry: TimeEntry) => void;
  onDeleteEntry: (entry: TimeEntry) => void;
  onStartTimer: (taskId: string) => void;
  /** FIX 2 — submit draft time for one task only */
  onSubmitTask?: (taskId: string) => void;
  defaultEntryDate: string;
};

type TaskGroup = {
  taskId: string | null;
  taskName: string;
  projectName: string;
  entries: TimeEntry[];
  totalMinutes: number;
  draftCount: number;
};

/**
 * Day/Week sheet with guiding empty state and clear locked rows (FIX 4).
 */
export function TimesheetPanel({
  mode,
  tasks,
  projectsById,
  entries,
  canEdit,
  canSubmit = false,
  submittingTaskId = null,
  timerBusy = false,
  runningTaskId = null,
  onAddTime,
  onEditEntry,
  onDeleteEntry,
  onStartTimer,
  onSubmitTask,
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
        draftCount: 0,
      });
    }

    const unassigned: TaskGroup = {
      taskId: null,
      taskName: 'Unassigned',
      projectName: 'No task',
      entries: [],
      totalMinutes: 0,
      draftCount: 0,
    };

    for (const entry of entries) {
      const lines = entry.timeLines ?? [];
      const first = lines.find((l) => l.isFirstLine) ?? lines[0];
      const taskId = first?.taskId ?? null;
      const mins = entryDurationMinutes(entry);
      const isDraft =
        entry.status === 'draft' || entry.status === 'rejected';

      const bump = (g: TaskGroup) => {
        g.entries.push(entry);
        g.totalMinutes += mins;
        if (isDraft) g.draftCount += 1;
      };

      if (taskId && byTask.has(taskId)) {
        bump(byTask.get(taskId)!);
      } else if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        let g = byTask.get(taskId);
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
            draftCount: 0,
          };
          byTask.set(taskId, g);
        }
        bump(g);
      } else {
        bump(unassigned);
      }
    }

    const list = [...byTask.values()]
      .filter((g) => g.entries.length > 0 || tasks.some((t) => t.id === g.taskId))
      .sort((a, b) => {
        if (b.totalMinutes !== a.totalMinutes) {
          return b.totalMinutes - a.totalMinutes;
        }
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
      <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-8 text-center">
        <p className="text-sm font-medium text-ink">No project tasks yet</p>
        <p className="mt-1 text-sm text-slate">
          Ask your manager to add you to a project before logging time.
        </p>
      </div>
    );
  }

  const periodLabel = mode === 'day' ? 'today' : 'this week';
  const noTimeLogged = entries.length === 0;

  return (
    <div className="space-y-3">
      {/* FIX 4 — guiding empty state */}
      {noTimeLogged ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-paper/40 px-5 py-6 text-center">
          <p className="text-sm font-medium text-ink">
            No time logged {periodLabel}
          </p>
          <p className="mt-1 text-sm text-slate">
            Start a timer above or add time on a task below.
          </p>
          {canEdit ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => onAddTime(undefined, defaultEntryDate)}
            >
              Add time
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/70 divide-y divide-border/40">
        {groups.map((group) => {
          const key = group.taskId ?? 'unassigned';
          const open = expanded[key] ?? group.totalMinutes > 0;
          const hasEntries = group.entries.length > 0;
          const sortedEntries = [...group.entries].sort((a, b) => {
            const aT = a.startTime ? new Date(a.startTime).getTime() : 0;
            const bT = b.startTime ? new Date(b.startTime).getTime() : 0;
            return aT - bT;
          });

          return (
            <section key={key} className="bg-transparent">
              <button
                type="button"
                onClick={() => toggle(key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-paper/40 sm:px-5"
                aria-expanded={open}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-ink">
                    {group.taskName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate">
                    {group.projectName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="tabular-nums text-sm font-semibold text-ink">
                      {group.totalMinutes > 0
                        ? formatHoursMinutes(group.totalMinutes)
                        : '—'}
                    </p>
                    <p className="text-xs text-slate">
                      {mode === 'day' ? "Today's total" : 'Period total'}
                    </p>
                  </div>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate"
                    aria-hidden
                  >
                    {open ? '▾' : '▸'}
                  </span>
                </div>
              </button>

              {open ? (
                <div className="space-y-4 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                  {sortedEntries.length === 0 ? (
                    <p className="text-sm text-slate">
                      No entries for {periodLabel} yet.
                    </p>
                  ) : (
                    <ul className="rounded-lg bg-paper/50 px-3 sm:px-4">
                      {sortedEntries.map((entry) => {
                        const locked = isEntryLocked(entry);
                        const running = isEntryRunning(entry);
                        const note = entryDescription(entry);
                        const dateLabel = entry.entryDate.slice(0, 10);

                        return (
                          <li
                            key={entry.id}
                            className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-border/30 py-3.5 last:border-b-0 ${
                              locked ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="tabular-nums text-sm font-medium text-ink">
                                  {formatEntryTimeLabel(entry)}
                                </span>
                                {mode === 'week' ? (
                                  <span className="text-xs text-slate">
                                    {dateLabel}
                                  </span>
                                ) : null}
                                {running ? (
                                  <Badge variant="coral">Running</Badge>
                                ) : locked || entry.status !== 'draft' ? (
                                  <Badge
                                    variant={entryStatusVariant(entry.status)}
                                  >
                                    {entryStatusLabel(entry.status)}
                                  </Badge>
                                ) : null}
                              </div>
                              {note ? (
                                <p className="truncate text-sm text-slate">
                                  {note}
                                </p>
                              ) : null}
                            </div>
                            {canEdit && !locked ? (
                              <div className="flex shrink-0 items-start gap-1">
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
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canEdit && group.taskId ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onAddTime(
                            group.taskId ?? undefined,
                            defaultEntryDate,
                          )
                        }
                      >
                        {hasEntries ? 'Add more time' : 'Add time'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={timerBusy || Boolean(runningTaskId)}
                        onClick={() => onStartTimer(group.taskId!)}
                      >
                        {runningTaskId === group.taskId
                          ? 'Running'
                          : 'Start timer'}
                      </Button>
                      {onSubmitTask && group.draftCount > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            !canSubmit || Boolean(submittingTaskId)
                          }
                          loading={submittingTaskId === group.taskId}
                          onClick={() => onSubmitTask(group.taskId!)}
                        >
                          Submit task
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
