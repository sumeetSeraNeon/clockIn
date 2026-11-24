'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { clientLabel } from '@/lib/client-label';
import type {
  Client,
  CreateTaskInput,
  MemberSummary,
  Project,
  ProjectMember,
  Task,
  TaskStatus,
  UpdateTaskInput,
} from '@/types/api';

type TaskFormProps = {
  mode: 'create' | 'edit';
  initial?: Task | null;
  projects: Project[];
  /** Optional — used for Client → Project cascade; otherwise derived from projects. */
  clients?: Client[];
  /** Fallback org members when project team cannot be loaded */
  members: MemberSummary[];
  submitting: boolean;
  /** FIX 5 — only billable:set may change task.billable */
  canSetBillable?: boolean;
  /** FINAL FIX 3 — members never see billable (remove, don't grey out) */
  showBillable?: boolean;
  /** FIX 4 — lock to this project (hide project picker; create stays open) */
  fixedProjectId?: string;
  /** Prefill name on create (inline Add from project Tasks tab). */
  defaultName?: string;
  onSubmit: (values: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  clientId: string;
  projectId: string;
  name: string;
  status: TaskStatus;
  assigneeId: string;
  estimatedHours: string;
  billable: boolean;
};

const EMPTY: FormState = {
  clientId: '',
  projectId: '',
  name: '',
  status: 'open',
  assigneeId: '',
  estimatedHours: '',
  billable: true,
};

function toNumberOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function TaskForm({
  mode,
  initial,
  projects,
  clients: clientsProp,
  members,
  submitting,
  canSetBillable = false,
  showBillable = false,
  fixedProjectId,
  defaultName = '',
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<{
    name?: string;
    projectId?: string;
    clientId?: string;
  }>({});
  const [assigneeOptions, setAssigneeOptions] = useState<MemberSummary[]>(
    members,
  );
  const [assigneesLoading, setAssigneesLoading] = useState(false);

  const lockProject = Boolean(fixedProjectId);
  const compactCreate = mode === 'create' && lockProject;

  const clientOptions = useMemo(() => {
    if (clientsProp && clientsProp.length > 0) {
      return [...clientsProp].sort((a, b) => a.name.localeCompare(b.name));
    }
    const byId = new Map<string, { id: string; name: string; code: string | null }>();
    for (const p of projects) {
      if (!p.clientId || byId.has(p.clientId)) continue;
      byId.set(p.clientId, {
        id: p.clientId,
        name: p.client?.name ?? 'Client',
        code: null,
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [clientsProp, projects]);

  const projectOptions = useMemo(() => {
    if (!form.clientId) return [];
    return projects
      .filter((p) => p.clientId === form.clientId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, form.clientId]);

  const selectedProject = projects.find((p) => p.id === form.projectId);
  const budgetHours =
    selectedProject?.budgetHours !== null &&
    selectedProject?.budgetHours !== undefined &&
    selectedProject.budgetHours !== ''
      ? Number(selectedProject.budgetHours)
      : null;
  const budgetHint =
    budgetHours !== null && Number.isFinite(budgetHours)
      ? `Project budget: ${budgetHours}h (estimates across open/done tasks cannot exceed this).`
      : undefined;

  useEffect(() => {
    if (mode === 'edit' && initial) {
      const project =
        projects.find((p) => p.id === initial.projectId) ??
        initial.project ??
        null;
      setForm({
        clientId: project?.clientId ?? '',
        projectId: initial.projectId,
        name: initial.name ?? '',
        status: (initial.status as TaskStatus) || 'open',
        assigneeId: initial.assigneeId ?? '',
        estimatedHours:
          initial.estimatedHours === null ||
          initial.estimatedHours === undefined
            ? ''
            : String(initial.estimatedHours),
        billable: initial.billable ?? true,
      });
    } else {
      const projectId = fixedProjectId || '';
      const project = projects.find((p) => p.id === projectId);
      setForm({
        ...EMPTY,
        clientId: project?.clientId ?? '',
        projectId,
        name: defaultName.trim(),
        billable: project?.billableByDefault ?? true,
      });
    }
    setErrors({});
  }, [mode, initial, projects, fixedProjectId, defaultName]);

  // STEP 1 — assignee dropdown = that project's team only
  useEffect(() => {
    if (!form.projectId) {
      setAssigneeOptions([]);
      return;
    }
    let cancelled = false;
    setAssigneesLoading(true);
    void (async () => {
      try {
        const team = await api<ProjectMember[]>(
          `/projects/${form.projectId}/members`,
        );
        if (cancelled) return;
        setAssigneeOptions(
          (team ?? []).map((row) => ({
            id: row.membershipId,
            status: row.membership.status,
            user: row.membership.user,
          })),
        );
      } catch {
        if (!cancelled) {
          // Fall back to org members so the form still works if team load fails
          setAssigneeOptions(members);
        }
      } finally {
        if (!cancelled) setAssigneesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.projectId, members]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'clientId') {
        next.projectId = '';
        next.assigneeId = '';
      }
      if (key === 'projectId') {
        next.assigneeId = '';
        if (value && !canSetBillable) {
          const project = projects.find((p) => p.id === value);
          if (project) next.billable = project.billableByDefault;
        }
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const nextErrors: {
      name?: string;
      projectId?: string;
      clientId?: string;
    } = {};
    if (!name) nextErrors.name = 'Name is required.';
    if (!lockProject && !form.clientId) nextErrors.clientId = 'Client is required.';
    if (!form.projectId) nextErrors.projectId = 'Project is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const estimatedHours = toNumberOrUndefined(form.estimatedHours);

    if (mode === 'create') {
      const payload: CreateTaskInput = {
        projectId: form.projectId,
        name,
        status: form.status,
        assigneeId: form.assigneeId || undefined,
        estimatedHours,
        ...(canSetBillable ? { billable: form.billable } : {}),
      };
      await onSubmit(payload);
      return;
    }

    const payload: UpdateTaskInput = {
      projectId: form.projectId,
      name,
      status: form.status,
      assigneeId: form.assigneeId || null,
      estimatedHours: estimatedHours ?? null,
      ...(canSetBillable ? { billable: form.billable } : {}),
    };
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {!lockProject ? (
          <>
            <FormField
              label="Client"
              htmlFor="task-client"
              error={errors.clientId}
              required
            >
              <Select
                id="task-client"
                value={form.clientId}
                onChange={(e) => setField('clientId', e.target.value)}
                invalid={Boolean(errors.clientId)}
                required
              >
                <option value="">Select a client</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientLabel(c)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Project"
              htmlFor="task-project"
              error={errors.projectId}
              required
            >
              <Select
                id="task-project"
                value={form.projectId}
                onChange={(e) => setField('projectId', e.target.value)}
                invalid={Boolean(errors.projectId)}
                required
                disabled={!form.clientId}
              >
                <option value="">
                  {!form.clientId ? 'Select a client first' : 'Select a project'}
                </option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </>
        ) : null}

        <FormField
          label="Name"
          htmlFor="task-name"
          error={errors.name}
          required
          className={lockProject ? 'sm:col-span-2' : 'sm:col-span-2'}
        >
          <Input
            id="task-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="Add task here"
            invalid={Boolean(errors.name)}
            required
          />
        </FormField>

        {compactCreate ? (
          <FormField
            label="Estimated hours"
            htmlFor="task-estimate"
            hint={budgetHint}
            className="sm:col-span-2"
          >
            <Input
              id="task-estimate"
              type="number"
              min={0}
              step="0.25"
              value={form.estimatedHours}
              onChange={(e) => setField('estimatedHours', e.target.value)}
              placeholder="8"
            />
          </FormField>
        ) : (
          <>
            <FormField label="Status" htmlFor="task-status">
              <Select
                id="task-status"
                value={form.status}
                onChange={(e) =>
                  setField('status', e.target.value as TaskStatus)
                }
              >
                <option value="open">Open</option>
                <option value="done">Done</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>
            <FormField
              label="Estimated hours"
              htmlFor="task-estimate"
              hint={budgetHint}
            >
              <Input
                id="task-estimate"
                type="number"
                min={0}
                step="0.25"
                value={form.estimatedHours}
                onChange={(e) => setField('estimatedHours', e.target.value)}
                placeholder="8"
              />
            </FormField>
          </>
        )}

        <FormField
          label="Primary owner"
          htmlFor="task-assignee"
          hint="Optional label. Anyone on this project’s Team can log time."
          className="sm:col-span-2"
        >
          <Select
            id="task-assignee"
            value={form.assigneeId}
            onChange={(e) => setField('assigneeId', e.target.value)}
            disabled={!form.projectId || assigneesLoading}
          >
            <option value="">
              {!form.projectId
                ? 'Select a project first'
                : assigneesLoading
                  ? 'Loading team…'
                  : 'Unassigned'}
            </option>
            {assigneeOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {showBillable && canSetBillable ? (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.billable}
            onChange={(e) => setField('billable', e.target.checked)}
            className="h-4 w-4 rounded border-border accent-coral"
          />
          Billable
        </label>
      ) : showBillable ? (
        <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-slate">
          Billable:{' '}
          <span className="font-medium text-ink">
            {form.billable ? 'Yes' : 'No'}
          </span>
          <span className="ml-1 text-xs">(from project — admin / PM)</span>
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
          {mode === 'create' ? 'Create task' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
