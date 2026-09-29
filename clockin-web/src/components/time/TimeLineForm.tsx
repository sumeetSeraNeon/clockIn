'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import type {
  Client,
  Project,
  Task,
  Ticket,
  TimeLine,
  TimeLineArea,
  TimeLineInput,
  TimeLineTicketType,
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
  ticketType: TimeLineTicketType | '';
  area: TimeLineArea | '';
  crId: string;
  crNumber: string;
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
  ticketType: '',
  area: '',
  crId: '',
  crNumber: '',
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
  tickets,
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
    cr?: string;
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
        ticketType: (initial.ticketType as TimeLineTicketType) || '',
        area: (initial.area as TimeLineArea) || '',
        crId: initial.crId ?? '',
        crNumber: initial.crNumber ?? '',
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
    const nextErrors: { duration?: string; cr?: string } = {};
    const durationMinutes = hideDuration
      ? 1
      : minutesFromParts(form.durationHours, form.durationMinutes);

    if (!hideDuration && durationMinutes < 1) {
      nextErrors.duration = 'Duration must be at least 1 minute.';
    }
    if (form.ticketType === 'cr' && (!form.crId.trim() || !form.crNumber.trim())) {
      nextErrors.cr = 'CR requires both CR id and CR number.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const base = {
      taskId: form.taskId || undefined,
      projectId: form.projectId || undefined,
      clientId: form.clientId || undefined,
      ticketId: form.ticketId || undefined,
      ticketType: form.ticketType || undefined,
      area: form.area || undefined,
      crId: form.ticketType === 'cr' ? form.crId.trim() : undefined,
      crNumber: form.ticketType === 'cr' ? form.crNumber.trim() : undefined,
      description: form.description.trim() || undefined,
      durationMinutes,
    };

    if (mode === 'edit') {
      const payload: UpdateTimeLineInput = {
        taskId: form.taskId || null,
        projectId: form.projectId || null,
        clientId: form.clientId || null,
        ticketId: form.ticketId || null,
        ticketType: form.ticketType || null,
        area: form.area || null,
        crId: form.ticketType === 'cr' ? form.crId.trim() : null,
        crNumber: form.ticketType === 'cr' ? form.crNumber.trim() : null,
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
  const filteredTasks = form.projectId
    ? tasks.filter((t) => t.projectId === form.projectId)
    : tasks;

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

      <FormField label="Task" htmlFor="line-task">
        <Select
          id="line-task"
          value={form.taskId}
          onChange={(e) => setField('taskId', e.target.value)}
        >
          <option value="">No task</option>
          {filteredTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.project?.name ? `${t.name} · ${t.project.name}` : t.name}
            </option>
          ))}
        </Select>
      </FormField>

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

      <div className="grid gap-4 sm:grid-cols-2">
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
        <FormField label="Ticket type" htmlFor="line-ticket-type">
          <Select
            id="line-ticket-type"
            value={form.ticketType}
            onChange={(e) =>
              setField('ticketType', e.target.value as TimeLineTicketType | '')
            }
          >
            <option value="">None</option>
            <option value="incident">Incident</option>
            <option value="sr">Service request</option>
            <option value="cr">Change request</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Linked ticket" htmlFor="line-ticket">
        <Select
          id="line-ticket"
          value={form.ticketId}
          onChange={(e) => setField('ticketId', e.target.value)}
        >
          <option value="">None</option>
          {tickets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.reference}
              {t.title ? ` — ${t.title}` : ''}
            </option>
          ))}
        </Select>
      </FormField>

      {form.ticketType === 'cr' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="CR id"
            htmlFor="line-cr-id"
            error={errors.cr}
            hint="ChangeRequest UUID from the API"
          >
            <Input
              id="line-cr-id"
              value={form.crId}
              onChange={(e) => setField('crId', e.target.value)}
              placeholder="uuid"
              invalid={Boolean(errors.cr)}
            />
          </FormField>
          <FormField label="CR number" htmlFor="line-cr-number">
            <Input
              id="line-cr-number"
              value={form.crNumber}
              onChange={(e) => setField('crNumber', e.target.value)}
              placeholder="CR-1042"
            />
          </FormField>
        </div>
      ) : null}

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

/** Compact timer-bar fields (description + task + optional billable label). */
export function TimerBarFields({
  description,
  onDescriptionChange,
  taskId,
  onTaskChange,
  tasks,
  projects,
  disabled,
  /** When set (running timer), show the line's stored billable. */
  storedBillable,
  /** FINAL FIX 3 — members never see billable */
  showBillable = false,
}: {
  description: string;
  onDescriptionChange: (v: string) => void;
  taskId: string;
  onTaskChange: (v: string) => void;
  tasks: Task[];
  projects: Project[];
  disabled?: boolean;
  storedBillable?: boolean | null;
  showBillable?: boolean;
}) {
  const billable =
    storedBillable !== undefined && storedBillable !== null
      ? storedBillable
      : previewInheritedBillable(taskId, '', tasks, projects);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="What are you working on?"
        disabled={disabled}
        className="min-w-0 flex-1"
      />
      <Select
        value={taskId}
        onChange={(e) => onTaskChange(e.target.value)}
        disabled={disabled}
        className="w-full sm:w-52"
      >
        <option value="">No task</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.project?.name ? `${t.name} · ${t.project.name}` : t.name}
          </option>
        ))}
      </Select>
      {showBillable ? (
        <p
          className={cn(
            'shrink-0 text-sm text-slate',
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
    </div>
  );
}
