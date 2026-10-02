'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { MoneyAmountField } from '@/components/common/MoneyAmountField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { toDateParam } from '@/lib/date-range';
import { formatMoney, resolveCurrency } from '@/lib/format-money';
import type {
  Client,
  CreateRatePairInput,
  Member,
  Project,
  ProjectMember,
} from '@/types/api';

type RatePairFormProps = {
  projects: Project[];
  clients?: Client[];
  /** Fallback when project team cannot be loaded */
  members?: Member[];
  /** Prefill / lock when opened from project Team */
  projectMembers?: ProjectMember[];
  defaultProjectId?: string;
  defaultUserId?: string;
  /** Org default when client has no override */
  orgCurrency?: string;
  /**
   * When set (e.g. project Team modal), use this currency label instead of
   * resolving from clients list.
   */
  displayCurrency?: string;
  initialCost?: string;
  initialBillable?: string;
  submitting: boolean;
  submitLabel?: string;
  onSubmit: (values: CreateRatePairInput) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  projectId: string;
  userId: string;
  costAmount: string;
  billableAmount: string;
  effectiveFrom: string;
};

type PersonOption = { userId: string; label: string };

function marginPreview(costRaw: string, billRaw: string) {
  const cost = Number(costRaw);
  const bill = Number(billRaw);
  if (!Number.isFinite(cost) || !Number.isFinite(bill)) return null;
  if (cost < 0 || bill < 0) return null;
  const margin = bill - cost;
  const pct = bill > 0 ? (margin / bill) * 100 : null;
  return { margin, pct };
}

/**
 * Project → person → cost + bill. Currency is resolved (client → org), not chosen.
 */
export function RatePairForm({
  projects,
  clients = [],
  members = [],
  projectMembers,
  defaultProjectId = '',
  defaultUserId = '',
  orgCurrency = 'GBP',
  displayCurrency: displayCurrencyProp,
  initialCost = '',
  initialBillable = '',
  submitting,
  submitLabel = 'Save rates',
  onSubmit,
  onCancel,
}: RatePairFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    projectId: defaultProjectId,
    userId: defaultUserId,
    costAmount: initialCost,
    billableAmount: initialBillable,
    effectiveFrom: toDateParam(new Date()),
  }));
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>(
    projectMembers ?? [],
  );
  const [teamLoading, setTeamLoading] = useState(false);
  const [errors, setErrors] = useState<{
    projectId?: string;
    userId?: string;
    costAmount?: string;
    billableAmount?: string;
    effectiveFrom?: string;
  }>({});

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      projectId: defaultProjectId || prev.projectId,
      userId: defaultUserId || prev.userId,
      ...(initialCost ? { costAmount: initialCost } : {}),
      ...(initialBillable ? { billableAmount: initialBillable } : {}),
    }));
  }, [defaultProjectId, defaultUserId, initialCost, initialBillable]);

  useEffect(() => {
    if (projectMembers) {
      setTeamMembers(projectMembers);
      return;
    }
    if (!form.projectId) {
      setTeamMembers([]);
      return;
    }
    let cancelled = false;
    setTeamLoading(true);
    void (async () => {
      try {
        const res = await api<ProjectMember[]>(
          `/projects/${form.projectId}/members`,
        );
        if (!cancelled) setTeamMembers(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setTeamMembers([]);
      } finally {
        if (!cancelled) setTeamLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.projectId, projectMembers]);

  const displayCurrency = useMemo(() => {
    if (displayCurrencyProp) {
      return resolveCurrency(displayCurrencyProp, orgCurrency);
    }
    const project = projects.find((p) => p.id === form.projectId);
    const clientCurrency = project
      ? clients.find((c) => c.id === project.clientId)?.currency
      : null;
    return resolveCurrency(clientCurrency, orgCurrency);
  }, [
    displayCurrencyProp,
    form.projectId,
    projects,
    clients,
    orgCurrency,
  ]);

  const personOptions: PersonOption[] = useMemo(() => {
    if (teamMembers.length > 0) {
      return teamMembers.map((pm) => ({
        userId: pm.membership.user.id,
        label: pm.membership.user.name || pm.membership.user.email,
      }));
    }
    return members.map((m) => ({
      userId: m.userId,
      label: m.user.name || m.user.email,
    }));
  }, [teamMembers, members]);

  const preview = marginPreview(form.costAmount, form.billableAmount);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      if (key === 'projectId') {
        return {
          ...prev,
          projectId: value as string,
          userId: '',
        };
      }
      return { ...prev, [key]: value };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    const cost = Number(form.costAmount);
    const bill = Number(form.billableAmount);
    if (!form.projectId) nextErrors.projectId = 'Project is required.';
    if (!form.userId) nextErrors.userId = 'Person is required.';
    if (!Number.isFinite(cost) || cost < 0) {
      nextErrors.costAmount = 'Enter a valid cost rate (≥ 0).';
    }
    if (!Number.isFinite(bill) || bill < 0) {
      nextErrors.billableAmount = 'Enter a valid billable rate (≥ 0).';
    }
    if (!form.effectiveFrom) {
      nextErrors.effectiveFrom = 'Effective from is required.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // FIX 3 — omit currency; API resolves from project → client → org
    await onSubmit({
      projectId: form.projectId,
      userId: form.userId,
      costAmount: cost,
      billableAmount: bill,
      effectiveFrom: form.effectiveFrom,
    });
  }

  const projectLocked = Boolean(defaultProjectId);
  const userLocked = Boolean(defaultUserId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Project"
        htmlFor="pair-project"
        error={errors.projectId}
      >
        <Select
          id="pair-project"
          value={form.projectId}
          onChange={(e) => setField('projectId', e.target.value)}
          disabled={submitting || projectLocked}
          invalid={Boolean(errors.projectId)}
        >
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Person" htmlFor="pair-user" error={errors.userId}>
        <Select
          id="pair-user"
          value={form.userId}
          onChange={(e) => setField('userId', e.target.value)}
          disabled={
            submitting || userLocked || !form.projectId || teamLoading
          }
          invalid={Boolean(errors.userId)}
        >
          <option value="">
            {!form.projectId
              ? 'Pick a project first'
              : teamLoading
                ? 'Loading…'
                : 'Select person'}
          </option>
          {personOptions.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.label}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyAmountField
          id="pair-cost"
          label="Cost / hour"
          value={form.costAmount}
          onChange={(v) => setField('costAmount', v)}
          currency={displayCurrency}
          error={errors.costAmount}
          placeholder="75.00"
          disabled={submitting}
          required
        />
        <MoneyAmountField
          id="pair-bill"
          label="Bill / hour"
          value={form.billableAmount}
          onChange={(v) => setField('billableAmount', v)}
          currency={displayCurrency}
          error={errors.billableAmount}
          placeholder="125.00"
          disabled={submitting}
          required
        />
      </div>

      {preview ? (
        <p className="rounded-lg border border-navy/10 bg-card px-3.5 py-2.5 text-sm text-navy">
          Margin{' '}
          <span className="font-semibold tabular-nums">
            {formatMoney(preview.margin, displayCurrency)}/h
          </span>
          {preview.pct != null ? (
            <span className="text-slate">
              {' '}
              · {preview.pct.toFixed(0)}%
            </span>
          ) : null}
        </p>
      ) : (
        <p className="text-xs text-slate">
          Enter cost and billable to see margin per hour.
        </p>
      )}

      <FormField
        label="Effective from"
        htmlFor="pair-from"
        error={errors.effectiveFrom}
      >
        <Input
          id="pair-from"
          type="date"
          value={form.effectiveFrom}
          onChange={(e) => setField('effectiveFrom', e.target.value)}
          invalid={Boolean(errors.effectiveFrom)}
          disabled={submitting}
          required
        />
      </FormField>

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
