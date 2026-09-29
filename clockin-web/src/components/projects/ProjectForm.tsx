'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type {
  Client,
  CreateProjectInput,
  MemberSummary,
  Project,
  ProjectStatus,
  UpdateProjectInput,
} from '@/types/api';

type ProjectFormProps = {
  mode: 'create' | 'edit';
  initial?: Project | null;
  clients: Client[];
  members: MemberSummary[];
  submitting: boolean;
  /** FIX 5 — only billable:set may change billableByDefault */
  canSetBillable?: boolean;
  /** FINAL FIX 3 — members never see billable */
  showBillable?: boolean;
  onSubmit: (values: CreateProjectInput | UpdateProjectInput) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  clientId: string;
  name: string;
  code: string;
  ownerId: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  budgetHours: string;
  budgetValue: string;
  billableByDefault: boolean;
  color: string;
};

const COLORS = ['#ff494a', '#14142b', '#1d9e75', '#ba7517', '#5f5e5a', '#3b82f6'];

const EMPTY: FormState = {
  clientId: '',
  name: '',
  code: '',
  ownerId: '',
  status: 'active',
  startDate: '',
  endDate: '',
  budgetHours: '',
  budgetValue: '',
  billableByDefault: true,
  color: COLORS[0],
};

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function toNumberOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function ProjectForm({
  mode,
  initial,
  clients,
  members,
  submitting,
  canSetBillable = false,
  showBillable = false,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<{ name?: string; clientId?: string }>(
    {},
  );

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm({
        clientId: initial.clientId,
        name: initial.name ?? '',
        code: initial.code ?? '',
        ownerId: initial.ownerId ?? '',
        status: (initial.status as ProjectStatus) || 'active',
        startDate: toDateInput(initial.startDate),
        endDate: toDateInput(initial.endDate),
        budgetHours:
          initial.budgetHours === null || initial.budgetHours === undefined
            ? ''
            : String(initial.budgetHours),
        budgetValue:
          initial.budgetValue === null || initial.budgetValue === undefined
            ? ''
            : String(initial.budgetValue),
        billableByDefault: initial.billableByDefault ?? true,
        color: initial.color || COLORS[0],
      });
    } else {
      setForm({
        ...EMPTY,
        clientId: clients[0]?.id ?? '',
      });
    }
    setErrors({});
  }, [mode, initial, clients]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const nextErrors: { name?: string; clientId?: string } = {};
    if (!name) nextErrors.name = 'Name is required.';
    if (!form.clientId) nextErrors.clientId = 'Client is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const budgetHours = toNumberOrUndefined(form.budgetHours);
    const budgetValue = toNumberOrUndefined(form.budgetValue);

    if (mode === 'create') {
      const payload: CreateProjectInput = {
        clientId: form.clientId,
        name,
        code: form.code.trim() || undefined,
        ownerId: form.ownerId || undefined,
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        budgetHours,
        budgetValue,
        ...(canSetBillable
          ? { billableByDefault: form.billableByDefault }
          : {}),
        color: form.color || undefined,
      };
      await onSubmit(payload);
      return;
    }

    const payload: UpdateProjectInput = {
      clientId: form.clientId,
      name,
      code: form.code.trim() || undefined,
      ownerId: form.ownerId || null,
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      budgetHours: budgetHours ?? null,
      budgetValue: budgetValue ?? null,
      ...(canSetBillable
        ? { billableByDefault: form.billableByDefault }
        : {}),
      color: form.color || null,
    };
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Client" htmlFor="project-client" error={errors.clientId}>
        <Select
          id="project-client"
          value={form.clientId}
          onChange={(e) => setField('clientId', e.target.value)}
          invalid={Boolean(errors.clientId)}
          required
        >
          <option value="" disabled>
            Select a client
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Name" htmlFor="project-name" error={errors.name}>
        <Input
          id="project-name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Acme Implementation"
          invalid={Boolean(errors.name)}
          required
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Code" htmlFor="project-code">
          <Input
            id="project-code"
            value={form.code}
            onChange={(e) => setField('code', e.target.value)}
            placeholder="ACME-IMP"
          />
        </FormField>
        <FormField label="Status" htmlFor="project-status">
          <Select
            id="project-status"
            value={form.status}
            onChange={(e) =>
              setField('status', e.target.value as ProjectStatus)
            }
          >
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Owner" htmlFor="project-owner" hint="Optional PM">
        <Select
          id="project-owner"
          value={form.ownerId}
          onChange={(e) => setField('ownerId', e.target.value)}
        >
          <option value="">No owner</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.user.name || m.user.email}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start date" htmlFor="project-start">
          <Input
            id="project-start"
            type="date"
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
          />
        </FormField>
        <FormField label="End date" htmlFor="project-end">
          <Input
            id="project-end"
            type="date"
            value={form.endDate}
            onChange={(e) => setField('endDate', e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Budget hours" htmlFor="project-budget-hours">
          <Input
            id="project-budget-hours"
            type="number"
            min={0}
            step="0.25"
            value={form.budgetHours}
            onChange={(e) => setField('budgetHours', e.target.value)}
            placeholder="120"
          />
        </FormField>
        <FormField label="Budget value" htmlFor="project-budget-value">
          <Input
            id="project-budget-value"
            type="number"
            min={0}
            step="0.01"
            value={form.budgetValue}
            onChange={(e) => setField('budgetValue', e.target.value)}
            placeholder="25000"
          />
        </FormField>
      </div>

      <FormField label="Colour" htmlFor="project-color">
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              onClick={() => setField('color', c)}
              className="h-8 w-8 rounded-full ring-offset-2 transition"
              style={{
                backgroundColor: c,
                boxShadow:
                  form.color === c ? `0 0 0 2px ${c}` : '0 0 0 1px #e5e2db',
              }}
            />
          ))}
          <Input
            id="project-color"
            value={form.color}
            onChange={(e) => setField('color', e.target.value)}
            className="max-w-[120px]"
            placeholder="#ff494a"
          />
        </div>
      </FormField>

      {showBillable && canSetBillable ? (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.billableByDefault}
            onChange={(e) => setField('billableByDefault', e.target.checked)}
            className="h-4 w-4 rounded border-border accent-coral"
          />
          Billable by default
        </label>
      ) : showBillable ? (
        <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-slate">
          Billable by default:{' '}
          <span className="font-medium text-ink">
            {form.billableByDefault ? 'Yes' : 'No'}
          </span>
          <span className="ml-1 text-xs">(controlled by admin / PM)</span>
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
          {mode === 'create' ? 'Create project' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
