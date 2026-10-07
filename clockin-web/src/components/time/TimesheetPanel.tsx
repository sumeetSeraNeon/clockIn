'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CollapserHeader } from '@/components/common/CollapserHeader';
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

type TaskNode = {
  taskId: string | null;
  taskName: string;
  entries: TimeEntry[];
  totalMinutes: number;
  draftCount: number;
};

type ProjectNode = {
  projectId: string;
  projectName: string;
  totalMinutes: number;
  tasks: TaskNode[];
};

type ClientNode = {
  clientId: string;
  clientName: string;
  totalMinutes: number;
  projects: ProjectNode[];
};

type SheetTree = {
  clients: ClientNode[];
  unassigned: TaskNode | null;
};

/**
 * Day/Week sheet — Client → Project → Task (only tasks with time).
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

  const tree = useMemo((): SheetTree => {
    type AccTask = TaskNode & {
      projectId: string | null;
      clientId: string;
      clientName: string;
      projectName: string;
    };

    const byTask = new Map<string, AccTask>();
    let unassigned: TaskNode | null = null;

    for (const entry of entries) {
      const lines = entry.timeLines ?? [];
      const first = lines.find((l) => l.isFirstLine) ?? lines[0];
      const taskId = first?.taskId ?? null;
      const mins = entryDurationMinutes(entry);
      const isDraft =
        entry.status === 'draft' || entry.status === 'rejected';

      if (!taskId) {
        if (!unassigned) {
          unassigned = {
            taskId: null,
            taskName: 'Unassigned',
            entries: [],
            totalMinutes: 0,
            draftCount: 0,
          };
        }
        unassigned.entries.push(entry);
        unassigned.totalMinutes += mins;
        if (isDraft) unassigned.draftCount += 1;
        continue;
      }

      let g = byTask.get(taskId);
      if (!g) {
        const task = tasks.find((t) => t.id === taskId);
        const projectId = task?.projectId ?? first?.projectId ?? null;
        const project =
          (projectId ? projectsById.get(projectId) : null) ?? null;
        const projectName = task?.project?.name || project?.name || 'Project';
        const clientId =
          project?.client?.id ?? project?.clientId ?? 'unknown-client';
        const clientName = project?.client?.name?.trim() || 'Client';
        g = {
          taskId,
          taskName: task?.name ?? 'Task',
          entries: [],
          totalMinutes: 0,
          draftCount: 0,
          projectId,
          clientId,
          clientName,
          projectName,
        };
        byTask.set(taskId, g);
      }
      g.entries.push(entry);
      g.totalMinutes += mins;
      if (isDraft) g.draftCount += 1;
    }

    const clientMap = new Map<string, ClientNode>();
    for (const g of byTask.values()) {
      const pid = g.projectId ?? 'unknown-project';
      let client = clientMap.get(g.clientId);
      if (!client) {
        client = {
          clientId: g.clientId,
          clientName: g.clientName,
          totalMinutes: 0,
          projects: [],
        };
        clientMap.set(g.clientId, client);
      }
      let project = client.projects.find((p) => p.projectId === pid);
      if (!project) {
        project = {
          projectId: pid,
          projectName: g.projectName,
          totalMinutes: 0,
          tasks: [],
        };
        client.projects.push(project);
      }
      project.tasks.push({
        taskId: g.taskId,
        taskName: g.taskName,
        entries: g.entries,
        totalMinutes: g.totalMinutes,
        draftCount: g.draftCount,
      });
      project.totalMinutes += g.totalMinutes;
      client.totalMinutes += g.totalMinutes;
    }

    const clients = [...clientMap.values()]
      .map((c) => ({
        ...c,
        projects: c.projects
          .map((p) => ({
            ...p,
            tasks: [...p.tasks].sort((a, b) => {
              if (b.totalMinutes !== a.totalMinutes) {
                return b.totalMinutes - a.totalMinutes;
              }
              return a.taskName.localeCompare(b.taskName);
            }),
          }))
          .sort((a, b) => a.projectName.localeCompare(b.projectName)),
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));

    return { clients, unassigned };
  }, [tasks, projectsById, entries]);

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isOpen(key: string, defaultOpen = true) {
    return expanded[key] ?? defaultOpen;
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
  const periodTotalLabel = mode === 'day' ? "Today's total" : 'Period total';

  function renderTaskSection(group: TaskNode): ReactNode {
    const key = `task-${group.taskId ?? 'unassigned'}`;
    const open = isOpen(key, true);
    const hasEntries = group.entries.length > 0;
    const sortedEntries = [...group.entries].sort((a, b) => {
      const aT = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bT = b.startTime ? new Date(b.startTime).getTime() : 0;
      return aT - bT;
    });

    return (
      <section key={key} className="border-t border-border/25">
        <CollapserHeader
          level="task"
          open={open}
          title={group.taskName}
          hoursLabel={formatHoursMinutes(group.totalMinutes)}
          hoursSubLabel={periodTotalLabel}
          onToggle={() => toggle(key)}
        />

        {open ? (
          <div className="space-y-4 px-4 pb-4 pt-1 sm:px-5 sm:pl-10 sm:pb-5">
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
                          <Badge variant={entryStatusVariant(entry.status)}>
                            {entryStatusLabel(entry.status)}
                          </Badge>
                        ) : null}
                      </div>
                      {note ? (
                        <p className="truncate text-sm text-slate">{note}</p>
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

            {canEdit && group.taskId ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onAddTime(group.taskId ?? undefined, defaultEntryDate)
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
                  {runningTaskId === group.taskId ? 'Running' : 'Start timer'}
                </Button>
                {onSubmitTask && group.draftCount > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canSubmit || Boolean(submittingTaskId)}
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
  }

  return (
    <div className="space-y-3">
      {noTimeLogged ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-paper/40 px-5 py-6 text-center">
          <p className="text-sm font-medium text-ink">
            No time logged {periodLabel}
          </p>
          <p className="mt-1 text-sm text-slate">
            Start a timer above or add time — pick Client, then Project, then
            Task.
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/70 shadow-sm shadow-navy/[0.03]">
          {tree.clients.map((client) => {
            const clientKey = `client-${client.clientId}`;
            const clientOpen = isOpen(clientKey, true);
            return (
              <div
                key={client.clientId}
                className="border-b border-border/40 last:border-b-0"
              >
                <CollapserHeader
                  level="client"
                  open={clientOpen}
                  title={client.clientName}
                  hoursLabel={formatHoursMinutes(client.totalMinutes)}
                  onToggle={() => toggle(clientKey)}
                />

                {clientOpen
                  ? client.projects.map((project) => {
                      const projectKey = `project-${project.projectId}`;
                      const projectOpen = isOpen(projectKey, true);
                      return (
                        <div
                          key={project.projectId}
                          className="border-t border-border/25"
                        >
                          <CollapserHeader
                            level="project"
                            open={projectOpen}
                            title={project.projectName}
                            hoursLabel={formatHoursMinutes(
                              project.totalMinutes,
                            )}
                            onToggle={() => toggle(projectKey)}
                          />

                          {projectOpen ? (
                            <div>
                              {project.tasks.map((task) =>
                                renderTaskSection(task),
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}

          {tree.unassigned ? (
            <div className="border-t border-border/40">
              {renderTaskSection(tree.unassigned)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
