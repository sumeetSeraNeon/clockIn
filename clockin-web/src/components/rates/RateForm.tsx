'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CurrencySelect } from '@/components/common/CurrencySelect';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toDateParam } from '@/lib/date-range';
import type {
  Client,
  CreateRateInput,
  Member,
  Project,
  RateScope,
  RateType,
  Task,
} from '@/types/api';

type RateFormProps = {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  members: Member[];
  /** Org default currency for the dropdown */
  defaultCurrency?: string;
  submitting: boolean;
  onSubmit: (values: CreateRateInput) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  rateType: RateType;
  scope: RateScope;
  clientId: string;
  projectId: string;
  userId: string;
  taskId: string;
  amount: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
};

export function RateForm({
  clients,
  projects,
  tasks,
  members,
  defaultCurrency = 'GBP',
  submitting,
  onSubmit,
  onCancel,
}: RateFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    rateType: 'billable',
    scope: 'project',
    clientId: '',
    projectId: '',
    userId: '',
    taskId: '',
    amount: '',
    currency: defaultCurrency,
    effectiveFrom: toDateParam(new Date()),
    effectiveTo: '',
  }));
  const [errors, setErrors] = useState<{
    amount?: string;
    scopeParent?: string;
    effectiveFrom?: string;
  }>({});

  useEffect(() => {
    setErrors({});
  }, [form.scope]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      if (key === 'scope') {
        return {
          ...prev,
          scope: value as RateScope,
          clientId: '',
          projectId: '',
          userId: '',
          taskId: '',
        };
      }
      if (key === 'projectId') {
        return { ...prev, projectId: value as string, taskId: '' };
      }
      return { ...prev, [key]: value };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: {
      amount?: string;
      scopeParent?: string;
      effectiveFrom?: string;
    } = {};
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      nextErrors.amount = 'Enter a valid amount (≥ 0).';
    }
    if (!form.effectiveFrom) {
      nextErrors.effectiveFrom = 'Effective from is required.';
    }

    switch (form.scope) {
      case 'client':
        if (!form.clientId) nextErrors.scopeParent = 'Client is required.';
        break;
      case 'project':
        if (!form.projectId) nextErrors.scopeParent = 'Project is required.';
        break;
      case 'user':
        if (!form.userId) nextErrors.scopeParent = 'Person is required.';
        break;
      case 'task':
        if (!form.projectId) nextErrors.scopeParent = 'Project is required.';
        else if (!form.taskId) nextErrors.scopeParent = 'Task is required.';
        break;
      case 'project_user':
        if (!form.projectId || !form.userId) {
          nextErrors.scopeParent = 'Project and person are required.';
        }
        break;
      default:
        break;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: CreateRateInput = {
      rateType: form.rateType,
      scope: form.scope,
      amount,
      currency: form.currency.trim().toUpperCase() || undefined,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      ...(form.scope === 'client' ? { clientId: form.clientId } : {}),
      ...(form.scope === 'project' || form.scope === 'project_user'
        ? { projectId: form.projectId }
        : {}),
      ...(form.scope === 'user' || form.scope === 'project_user'
        ? { userId: form.userId }
        : {}),
      ...(form.scope === 'task' ? { taskId: form.taskId } : {}),
    };

    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Rate type" htmlFor="rate-type">
          <Select
            id="rate-type"
            value={form.rateType}
            onChange={(e) => setField('rateType', e.target.value as RateType)}
          >
            <option value="billable">Billable — what you charge</option>
            <option value="cost">Cost — what it costs you</option>
          </Select>
        </FormField>
        <FormField label="Scope" htmlFor="rate-scope">
          <Select
            id="rate-scope"
            value={form.scope}
            onChange={(e) => setField('scope', e.target.value as RateScope)}
          >
            <option value="project">Project</option>
            <option value="task">Task (pick project first)</option>
            <optgroup label="Advanced fallbacks">
              <option value="organisation">Organisation</option>
              <option value="client">Client</option>
              <option value="user">User</option>
              <option value="project_user">
                Project + user (single type)
              </option>
            </optgroup>
          </Select>
        </FormField>
      </div>

      {form.scope === 'client' && (
        <FormField
          label="Client"
          htmlFor="rate-client"
          error={errors.scopeParent}
        >
          <Select
            id="rate-client"
            value={form.clientId}
            onChange={(e) => setField('clientId', e.target.value)}
            invalid={Boolean(errors.scopeParent)}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {(form.scope === 'project' ||
        form.scope === 'project_user' ||
        form.scope === 'task') && (
        <FormField
          label="Project"
          htmlFor="rate-project"
          error={
            form.scope === 'task' && !form.projectId
              ? errors.scopeParent
              : form.scope !== 'task'
                ? errors.scopeParent
                : undefined
          }
        >
          <Select
            id="rate-project"
            value={form.projectId}
            onChange={(e) => setField('projectId', e.target.value)}
            invalid={Boolean(errors.scopeParent) && form.scope !== 'task'}
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {(form.scope === 'user' || form.scope === 'project_user') && (
        <FormField
          label="Person"
          htmlFor="rate-user"
          error={errors.scopeParent}
          hint="Uses the user id (not membership id)"
        >
          <Select
            id="rate-user"
            value={form.userId}
            onChange={(e) => setField('userId', e.target.value)}
            invalid={Boolean(errors.scopeParent)}
          >
            <option value="">Select person</option>
            {members.map((m) => (
              <option key={m.id} value={m.userId}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {form.scope === 'task' && (
        <FormField
          label="Task"
          htmlFor="rate-task"
          error={errors.scopeParent}
          hint="Filtered to the project above"
        >
          <Select
            id="rate-task"
            value={form.taskId}
            onChange={(e) => setField('taskId', e.target.value)}
            invalid={Boolean(errors.scopeParent)}
            disabled={!form.projectId}
          >
            <option value="">
              {form.projectId ? 'Select task' : 'Pick a project first'}
            </option>
            {tasks
              .filter((t) => t.projectId === form.projectId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </FormField>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" htmlFor="rate-amount" error={errors.amount}>
          <Input
            id="rate-amount"
            type="number"
            min={0}
            step="0.01"
            value={form.amount}
            onChange={(e) => setField('amount', e.target.value)}
            placeholder="85.00"
            invalid={Boolean(errors.amount)}
            required
          />
        </FormField>
        <FormField label="Currency" htmlFor="rate-currency" hint="ISO 4217">
          <CurrencySelect
            id="rate-currency"
            value={form.currency}
            onChange={(code) => setField('currency', code)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Effective from"
          htmlFor="rate-from"
          error={errors.effectiveFrom}
        >
          <Input
            id="rate-from"
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setField('effectiveFrom', e.target.value)}
            invalid={Boolean(errors.effectiveFrom)}
            required
          />
        </FormField>
        <FormField
          label="Effective to"
          htmlFor="rate-to"
          hint="Leave blank for open-ended (current)"
        >
          <Input
            id="rate-to"
            type="date"
            value={form.effectiveTo}
            onChange={(e) => setField('effectiveTo', e.target.value)}
          />
        </FormField>
      </div>

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
          Add rate
        </Button>
      </div>
    </form>
  );
}
