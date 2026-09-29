'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type {
  Client,
  ClientStatus,
  CreateClientInput,
  MemberSummary,
  UpdateClientInput,
} from '@/types/api';

type ClientFormProps = {
  mode: 'create' | 'edit';
  initial?: Client | null;
  members: MemberSummary[];
  submitting: boolean;
  onSubmit: (values: CreateClientInput | UpdateClientInput) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  name: string;
  code: string;
  currency: string;
  status: ClientStatus;
  ownerId: string;
  externalRef: string;
};

const EMPTY: FormState = {
  name: '',
  code: '',
  currency: 'GBP',
  status: 'active',
  ownerId: '',
  externalRef: '',
};

export function ClientForm({
  mode,
  initial,
  members,
  submitting,
  onSubmit,
  onCancel,
}: ClientFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm({
        name: initial.name ?? '',
        code: initial.code ?? '',
        currency: initial.currency ?? 'GBP',
        status: (initial.status as ClientStatus) || 'active',
        ownerId: initial.ownerId ?? '',
        externalRef: initial.externalRef ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setNameError(null);
  }, [mode, initial]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setNameError('Name is required.');
      return;
    }
    setNameError(null);

    const payload = {
      name,
      code: form.code.trim() || undefined,
      currency: form.currency.trim().toUpperCase() || undefined,
      status: form.status,
      externalRef: form.externalRef.trim() || undefined,
      ownerId: form.ownerId || (mode === 'edit' ? null : undefined),
    };

    await onSubmit(payload);
  }

  return (
    <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Name" htmlFor="client-name" error={nameError}>
        <Input
          id="client-name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Acme Corp"
          invalid={Boolean(nameError)}
          required
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Code" htmlFor="client-code" hint="Optional short code">
          <Input
            id="client-code"
            value={form.code}
            onChange={(e) => setField('code', e.target.value)}
            placeholder="ACME"
          />
        </FormField>
        <FormField label="Currency" htmlFor="client-currency">
          <Input
            id="client-currency"
            value={form.currency}
            onChange={(e) => setField('currency', e.target.value.toUpperCase())}
            placeholder="GBP"
            maxLength={3}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Status" htmlFor="client-status">
          <Select
            id="client-status"
            value={form.status}
            onChange={(e) => setField('status', e.target.value as ClientStatus)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </Select>
        </FormField>
        <FormField
          label="Owner"
          htmlFor="client-owner"
          hint="Account manager (optional)"
        >
          <Select
            id="client-owner"
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
      </div>

      <FormField
        label="External ref"
        htmlFor="client-external"
        hint="CRM id — optional"
      >
        <Input
          id="client-external"
          value={form.externalRef}
          onChange={(e) => setField('externalRef', e.target.value)}
          placeholder="crm-123"
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
          {mode === 'create' ? 'Create client' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
