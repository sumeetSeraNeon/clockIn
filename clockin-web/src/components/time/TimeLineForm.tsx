'use client';

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import { TaskSearchSelect } from '@/components/time/TaskSearchSelect';
import { TicketOptionalSelect } from '@/components/time/TicketOptionalSelect';
import {
  clientIdForProject,
  clientsFromProjects,
  projectIdForTask,
  projectsForClient,
  projectsScopedToTasks,
} from '@/lib/task-project-picker';
import type {
  Client,
  Project,
  Task,
  Ticket,
  TimeLine,
  TimeLineArea,
  TimeLineInput,
  UpdateTimeLineInput,
} from '@/types/api';

export type TimeLineFormMode = 'create' | 'edit';

type TimeLineFormProps = {
  mode: TimeLineFormMode;
  initial?: TimeLine | null;
  /** Prefill create form (e.g. from week grid cell). */
  defaults?: {
    projectId?: string | null;
    clientId?: string | null;
  };
  /** When create, require duration; used for manual + add-line. */
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  tickets: Ticket[];
  submitting: boolean;
  submitLabel: string;
  onSubmit: (
    values: TimeLineInput | UpdateTimeLineInput,
  ) => Promise<void>;
  onCancel: () => void;
  /** Hide duration for timer start (we send placeholder 1). */
  hideDuration?: boolean;
  /** R2-FIX 1 — admin/owner/PM may override billable on an existing line. */
  canSetBillable?: boolean;
  /** FINAL FIX 3 — members never see billable (remove, don't grey out) */
  showBillable?: boolean;
};

type FormState = {
  description: string;
  taskId: string;
  projectId: string;
  clientId: string;
  ticketId: string;
  area: TimeLineArea | '';
  durationHours: string;
  durationMinutes: string;
  /** Edit-mode override / stored display; create uses inheritance preview. */
  billable: boolean;
};

const EMPTY: FormState = {
  description: '',
  taskId: '',
  projectId: '',
  clientId: '',
  ticketId: '',
  area: '',
  durationHours: '0',
  durationMinutes: '30',
  billable: false,
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

/** Preview what the API will inherit on create (task → project → false). */
function previewInheritedBillable(
  taskId: string,
  projectId: string,
  tasks: Task[],
  projects: Project[],
): boolean {
  if (taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (task) return task.billable;
  }
  if (projectId) {
    const project = projects.find((p) => p.id === projectId);
    if (project) return project.billableByDefault;
  }
  return false;
}

export function TimeLineForm({
  mode,
  initial,
  defaults,
  clients,
  projects,
  tasks,
  tickets: _tickets,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
  hideDuration = false,
  canSetBillable = false,
  showBillable = false,
}: TimeLineFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<{
    duration?: string;
  }>({});

  useEffect(() => {
    if (mode === 'edit' && initial) {
      const parts = partsFromMinutes(initial.durationMinutes);
      setForm({
        description: initial.description ?? '',
        taskId: initial.taskId ?? '',
        projectId: initial.projectId ?? '',
        clientId: initial.clientId ?? '',
        ticketId: initial.ticketId ?? '',
        area: (initial.area as TimeLineArea) || '',
        durationHours: parts.durationHours,
        durationMinutes: parts.durationMinutes,
        // R2-FIX 1 — show the line's stored value, not a live task lookup
        billable: initial.billable,
      });
    } else {
      const projectId = defaults?.projectId ?? '';
      let clientId = defaults?.clientId ?? '';
      if (projectId && !clientId) {
        const project = projects.find((p) => p.id === projectId);
        if (project) clientId = project.clientId;
      }
      setForm({
        ...EMPTY,
        projectId: projectId || '',
        clientId: clientId || '',
        billable: previewInheritedBillable(
          '',
          projectId || '',
          tasks,
          projects,
        ),
      });
    }
    setErrors({});
  }, [mode, initial, defaults?.projectId, defaults?.clientId, projects, tasks]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'taskId' && value) {
        const task = tasks.find((t) => t.id === value);
        if (task) {
          next.projectId = task.projectId;
          const project = projects.find((p) => p.id === task.projectId);
          if (project) next.clientId = project.clientId;
          // Create: preview updates with task. Edit + no billable:set: keep stored
          // until save (task change re-inherits on server). Edit + canSetBillable:
          // preview the new inheritance so the toggle matches what save would store
          // unless they already overrode — we still update preview on task change.
          if (mode === 'create' || canSetBillable) {
            next.billable = task.billable;
          }
        }
      }
      if (key === 'taskId' && !value && mode === 'create') {
        next.billable = previewInheritedBillable(
          '',
          next.projectId,
          tasks,
          projects,
        );
      }
      return next;
    });
  }

  /** Create-mode / preview: task → project → false. Edit-mode display uses form.billable. */
  function displayBillable(): boolean {
    if (mode === 'edit') return form.billable;
    return previewInheritedBillable(
      form.taskId,
      form.projectId,
      tasks,
      projects,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: { duration?: string } = {};
    const durationMinutes = hideDuration
      ? 1
      : minutesFromParts(form.durationHours, form.durationMinutes);

    if (!hideDuration && durationMinutes < 1) {
      nextErrors.duration = 'Duration must be at least 1 minute.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const base = {
      taskId: form.taskId || undefined,
      projectId: form.projectId || undefined,
      clientId: form.clientId || undefined,
      ticketId: form.ticketId || undefined,
      area: form.area || undefined,
      description: form.description.trim() || undefined,
      durationMinutes,
    };

    if (mode === 'edit') {
      const payload: UpdateTimeLineInput = {
        taskId: form.taskId || null,
        projectId: form.projectId || null,
        clientId: form.clientId || null,
        ticketId: form.ticketId || null,
        area: form.area || null,
        description: form.description.trim() || null,
        durationMinutes,
        ...(canSetBillable ? { billable: form.billable } : {}),
      };
      await onSubmit(payload);
      return;
    }

    // Create — never send billable; API inherits
    await onSubmit(base as TimeLineInput);
  }

  const filteredProjects = form.clientId
    ? projects.filter((p) => p.clientId === form.clientId)
    : projects;
  const selectedTaskLabel =
    tasks.find((t) => t.id === form.taskId)?.name ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Description" htmlFor="line-description">
        <Input
          id="line-description"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="What are you working on?"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Client" htmlFor="line-client">
          <Select
            id="line-client"
            value={form.clientId}
            onChange={(e) => {
              setForm((prev) => ({
                ...prev,
                clientId: e.target.value,
                projectId: '',
                taskId: '',
                ticketId: '',
              }));
            }}
          >
            <option value="">Any</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Project" htmlFor="line-project">
          <Select
            id="line-project"
            value={form.projectId}
            onChange={(e) => {
              setForm((prev) => ({
                ...prev,
                projectId: e.target.value,
                taskId: '',
                ticketId: '',
              }));
            }}
          >
            <option value="">Any</option>
            {filteredProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <TaskSearchSelect
        id="line-task"
        projectId={form.projectId}
        value={form.taskId}
        onChange={(taskId) => setField('taskId', taskId)}
        selectedLabel={selectedTaskLabel}
        required={false}
      />

      {!hideDuration ? (
        <FormField
          label="Duration"
          htmlFor="line-duration-h"
          error={errors.duration}
        >
          <div className="flex items-center gap-2">
            <Input
              id="line-duration-h"
              type="number"
              min={0}
              value={form.durationHours}
              onChange={(e) => setField('durationHours', e.target.value)}
              className="w-20"
              aria-label="Hours"
            />
            <span className="text-sm text-slate">h</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={form.durationMinutes}
              onChange={(e) => setField('durationMinutes', e.target.value)}
              className="w-20"
              aria-label="Minutes"
            />
            <span className="text-sm text-slate">m</span>
          </div>
        </FormField>
      ) : null}

      <FormField label="Area" htmlFor="line-area">
        <Select
          id="line-area"
          value={form.area}
          onChange={(e) =>
            setField('area', e.target.value as TimeLineArea | '')
          }
        >
          <option value="">None</option>
          <option value="functional">Functional</option>
          <option value="technical">Technical</option>
          <option value="integration">Integration</option>
          <option value="pm">PM</option>
        </Select>
      </FormField>

      <TicketOptionalSelect
        id="line-ticket"
        projectId={form.projectId}
        value={form.ticketId}
        onChange={(ticketId) => setField('ticketId', ticketId)}
      />

      {showBillable && mode === 'edit' && canSetBillable ? (
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-[var(--coral)]"
            checked={form.billable}
            onChange={(e) => setField('billable', e.target.checked)}
          />
          <span>
            Billable
            <span className="ml-1 text-xs font-normal text-slate">
              (override — admin / project manager)
            </span>
          </span>
        </label>
      ) : showBillable ? (
        <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-slate">
          {displayBillable() ? 'Billable' : 'Non-billable'}
          <span className="ml-1 text-xs">
            {mode === 'edit'
              ? '(stored on this line)'
              : '(from task / project — inherited on save)'}
          </span>
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
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

/** Compact timer-bar fields (Client → Project → Task → Ticket + optional billable). */
export function TimerBarFields({
  description,
  onDescriptionChange,
  taskId,
  onTaskChange,
  ticketId = '',
  onTicketChange,
  tasks,
  projects,
  disabled,
  /** When set (running timer), show the line's stored billable. */
  storedBillable,
  /** FINAL FIX 3 — members never see billable */
  showBillable = false,
  /** Elapsed + Start/Stop cluster on the project/task row */
  actions,
}: {
  description: string;
  onDescriptionChange: (v: string) => void;
  taskId: string;
  onTaskChange: (v: string) => void;
  ticketId?: string;
  onTicketChange?: (v: string) => void;
  tasks: Task[];
  projects: Project[];
  disabled?: boolean;
  storedBillable?: boolean | null;
  showBillable?: boolean;
  actions?: ReactNode;
}) {
  const scopedProjects = useMemo(
    () => projectsScopedToTasks(tasks, projects),
    [tasks, projects],
  );
  const selectedProjectId = projectIdForTask(tasks, taskId);
  const selectedClientId = clientIdForProject(scopedProjects, selectedProjectId);
  const [clientId, setClientId] = useState(selectedClientId);
  const [projectId, setProjectId] = useState(selectedProjectId);
  const clientOptions = clientsFromProjects(scopedProjects);
  const projectOptions = projectsForClient(scopedProjects, clientId);
  const selectedTaskLabel =
    tasks.find((t) => t.id === taskId)?.name ?? null;

  useEffect(() => {
    if (!taskId) return;
    const nextProjectId = projectIdForTask(tasks, taskId);
    const nextClientId = clientIdForProject(scopedProjects, nextProjectId);
    setProjectId(nextProjectId);
    setClientId(nextClientId);
  }, [taskId, tasks, scopedProjects]);

  const billable =
    storedBillable !== undefined && storedBillable !== null
      ? storedBillable
      : previewInheritedBillable(taskId, projectId, tasks, projects);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <Input
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="What are you working on?"
        disabled={disabled}
        className="w-full min-w-0"
      />
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 w-full flex-col gap-1 text-xs text-slate sm:flex-1">
          <span>
            Client
            <span className="ml-0.5 text-coral" aria-hidden="true">
              *
            </span>
          </span>
          <Select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setProjectId('');
              onTaskChange('');
              onTicketChange?.('');
            }}
            disabled={disabled}
            className="min-w-0 w-full"
            aria-label="Client"
          >
            <option value="">Select client…</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-0 w-full flex-col gap-1 text-xs text-slate sm:flex-1">
          <span>
            Project
            <span className="ml-0.5 text-coral" aria-hidden="true">
              *
            </span>
          </span>
          <Select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              onTaskChange('');
              onTicketChange?.('');
            }}
            disabled={disabled || !clientId}
            className="min-w-0 w-full"
            aria-label="Project"
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
        </label>
        <TaskSearchSelect
          compact
          id="timer-task"
          projectId={projectId}
          value={taskId}
          onChange={onTaskChange}
          disabled={disabled}
          selectedLabel={selectedTaskLabel}
        />
        {onTicketChange ? (
          <TicketOptionalSelect
            compact
            id="timer-ticket"
            projectId={projectId}
            value={ticketId}
            onChange={onTicketChange}
            disabled={disabled}
          />
        ) : null}
        {showBillable ? (
          <p
            className={cn(
              'shrink-0 pb-2 text-sm text-slate',
              disabled && 'opacity-60',
            )}
            title={
              storedBillable !== undefined && storedBillable !== null
                ? 'Stored on this time line'
                : 'Will inherit from task / project on start'
            }
          >
            {billable ? 'Billable' : 'Non-billable'}
          </p>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
