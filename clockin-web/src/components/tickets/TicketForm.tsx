'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import type {
  Client,
  CreateTicketInput,
  Project,
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketType,
  UpdateTicketInput,
} from '@/types/api';
import { TICKET_NEXT_STATUS } from '@/types/api';

type TicketFormProps = {
  mode: 'create' | 'edit';
  initial?: Ticket | null;
  clients: Client[];
  projects: Project[];
  submitting: boolean;
  onSubmit: (values: CreateTicketInput | UpdateTicketInput) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  clientId: string;
  projectId: string;
  reference: string;
  ticketType: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority | '';
  raisedBy: string;
};

const EMPTY: FormState = {
  clientId: '',
  projectId: '',
  reference: '',
  ticketType: 'incident',
  title: '',
  description: '',
  status: 'open',
  priority: 'medium',
  raisedBy: '',
};

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function TicketForm({
  mode,
  initial,
  clients,
  projects,
  submitting,
  onSubmit,
  onCancel,
}: TicketFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<{
    clientId?: string;
    reference?: string;
  }>({});

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm({
        clientId: initial.clientId,
        projectId: initial.projectId ?? '',
        reference: initial.reference ?? '',
        ticketType: (initial.ticketType as TicketType) || 'incident',
        title: initial.title ?? '',
        description: initial.description ?? '',
        status: (initial.status as TicketStatus) || 'open',
        priority: (initial.priority as TicketPriority) || '',
        raisedBy: initial.raisedBy ?? '',
      });
    } else {
      setForm({
        ...EMPTY,
        clientId: clients[0]?.id ?? '',
      });
    }
    setErrors({});
  }, [mode, initial, clients]);

  const clientProjects = useMemo(
    () => projects.filter((p) => p.clientId === form.clientId),
    [projects, form.clientId],
  );

  const nextStatus =
    mode === 'edit' ? TICKET_NEXT_STATUS[form.status] : null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'clientId') {
        next.projectId = '';
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const reference = form.reference.trim();
    const nextErrors: { clientId?: string; reference?: string } = {};
    if (!form.clientId) nextErrors.clientId = 'Client is required.';
    if (mode === 'create' && !reference) {
      nextErrors.reference = 'Reference is required.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (mode === 'create') {
      const payload: CreateTicketInput = {
        clientId: form.clientId,
        projectId: form.projectId || undefined,
        reference,
        ticketType: form.ticketType,
        title: form.title.trim() || undefined,
        description: form.description.trim() || undefined,
        priority: form.priority || undefined,
        raisedBy: form.raisedBy.trim() || undefined,
      };
      await onSubmit(payload);
      return;
    }

    const payload: UpdateTicketInput = {
      clientId: form.clientId,
      projectId: form.projectId || null,
      title: form.title.trim() || undefined,
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority || null,
      raisedBy: form.raisedBy.trim() || null,
    };
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Client" htmlFor="ticket-client" error={errors.clientId}>
        <Select
          id="ticket-client"
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

      <FormField
        label="Project"
        htmlFor="ticket-project"
        hint="Optional — must belong to the client"
      >
        <Select
          id="ticket-project"
          value={form.projectId}
          onChange={(e) => setField('projectId', e.target.value)}
        >
          <option value="">No project</option>
          {clientProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      {mode === 'create' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Reference"
            htmlFor="ticket-reference"
            error={errors.reference}
            hint="Unique per org, e.g. INC-1042"
          >
            <Input
              id="ticket-reference"
              value={form.reference}
              onChange={(e) => setField('reference', e.target.value)}
              placeholder="INC-1042"
              invalid={Boolean(errors.reference)}
              required
            />
          </FormField>
          <FormField label="Type" htmlFor="ticket-type">
            <Select
              id="ticket-type"
              value={form.ticketType}
              onChange={(e) =>
                setField('ticketType', e.target.value as TicketType)
              }
            >
              <option value="incident">Incident</option>
              <option value="service_request">Service request</option>
            </Select>
          </FormField>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Reference" htmlFor="ticket-reference-ro">
            <Input
              id="ticket-reference-ro"
              value={form.reference}
              disabled
              readOnly
            />
          </FormField>
          <FormField label="Type" htmlFor="ticket-type-ro">
            <Input
              id="ticket-type-ro"
              value={statusLabel(form.ticketType)}
              disabled
              readOnly
            />
          </FormField>
        </div>
      )}

      <FormField label="Title" htmlFor="ticket-title">
        <Input
          id="ticket-title"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="Login page returns 500"
        />
      </FormField>

      <FormField label="Description" htmlFor="ticket-description">
        <textarea
          id="ticket-description"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          rows={4}
          placeholder="What happened, expected vs actual…"
          className={cn(
            'w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-ink',
            'outline-none focus:outline-none focus-visible:outline-none',
            'placeholder:text-slate/55 resize-y min-h-[96px]',
          )}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Priority" htmlFor="ticket-priority">
          <Select
            id="ticket-priority"
            value={form.priority}
            onChange={(e) =>
              setField('priority', e.target.value as TicketPriority | '')
            }
          >
            <option value="">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </FormField>
        <FormField label="Raised by" htmlFor="ticket-raised-by">
          <Input
            id="ticket-raised-by"
            value={form.raisedBy}
            onChange={(e) => setField('raisedBy', e.target.value)}
            placeholder="Name or email"
          />
        </FormField>
      </div>

      {mode === 'edit' ? (
        <FormField
          label="Status"
          htmlFor="ticket-status"
          hint={
            nextStatus
              ? `Next allowed: ${statusLabel(nextStatus)}`
              : 'Already closed — no further transitions'
          }
        >
          <Select
            id="ticket-status"
            value={form.status}
            onChange={(e) =>
              setField('status', e.target.value as TicketStatus)
            }
          >
            <option value={form.status}>{statusLabel(form.status)}</option>
            {nextStatus ? (
              <option value={nextStatus}>{statusLabel(nextStatus)}</option>
            ) : null}
          </Select>
        </FormField>
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
          {mode === 'create' ? 'Create ticket' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
