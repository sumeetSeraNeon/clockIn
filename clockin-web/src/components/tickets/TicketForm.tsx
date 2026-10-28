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
  TicketDepartmentOption,
  TicketPriority,
  TicketPriorityCode,
  TicketStatus,
  TicketType,
  UpdateTicketInput,
} from '@/types/api';
import {
  TICKET_PRIORITY_CODE_LABELS,
  TICKET_PRIORITY_CODES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  TICKET_TYPE_LABELS,
  TICKET_TYPES,
} from '@/types/api';

type TicketFormProps = {
  mode: 'create' | 'edit';
  initial?: Ticket | null;
  clients: Client[];
  projects: Project[];
  departments?: TicketDepartmentOption[];
  submitting: boolean;
  /** View-only (members). */
  readOnly?: boolean;
  /** Hide Cancel when embedded on detail page (use page Back instead). */
  hideCancel?: boolean;
  onSubmit: (values: CreateTicketInput | UpdateTicketInput) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  clientId: string;
  projectId: string;
  departmentId: string;
  reference: string;
  ticketType: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority | '';
  ticketPriority: TicketPriorityCode | '';
  raisedBy: string;
  agentName: string;
  internalAgentName: string;
  contactName: string;
  contactEmail: string;
  contactExternalId: string;
  source: string;
  tags: string;
  workstream: string;
  dueAt: string;
};

const EMPTY: FormState = {
  clientId: '',
  projectId: '',
  departmentId: '',
  reference: '',
  ticketType: 'incident',
  title: '',
  description: '',
  status: 'open',
  priority: 'medium',
  ticketPriority: '',
  raisedBy: '',
  agentName: '',
  internalAgentName: '',
  contactName: '',
  contactEmail: '',
  contactExternalId: '',
  source: '',
  tags: '',
  workstream: '',
  dueAt: '',
};

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const s = value.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatStamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TicketForm({
  mode,
  initial,
  clients,
  projects,
  departments = [],
  submitting,
  readOnly = false,
  hideCancel = false,
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
        departmentId: initial.departmentId ?? '',
        reference: initial.reference ?? '',
        ticketType: (initial.ticketType as TicketType) || 'incident',
        title: initial.title ?? '',
        description: initial.description ?? '',
        status: (initial.status as TicketStatus) || 'open',
        priority: (initial.priority as TicketPriority) || '',
        ticketPriority: (initial.ticketPriority as TicketPriorityCode) || '',
        raisedBy: initial.raisedBy ?? '',
        agentName: initial.agentName ?? '',
        internalAgentName: initial.internalAgentName ?? '',
        contactName: initial.contactName ?? '',
        contactEmail: initial.contactEmail ?? '',
        contactExternalId: initial.contactExternalId ?? '',
        source: initial.source ?? '',
        tags: initial.tags ?? '',
        workstream: initial.workstream ?? '',
        dueAt: toDatetimeLocalValue(initial.dueAt),
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

    const contactName = form.contactName.trim() || form.raisedBy.trim();
    const dueAtIso = fromDatetimeLocalValue(form.dueAt);

    if (mode === 'create') {
      const payload: CreateTicketInput = {
        clientId: form.clientId,
        projectId: form.projectId || undefined,
        departmentId: form.departmentId || undefined,
        reference,
        ticketType: form.ticketType,
        title: form.title.trim() || undefined,
        description: form.description.trim() || undefined,
        status: form.status,
        priority: form.priority || undefined,
        ticketPriority: form.ticketPriority || undefined,
        raisedBy: form.raisedBy.trim() || contactName || undefined,
        agentName: form.agentName.trim() || undefined,
        internalAgentName: form.internalAgentName.trim() || undefined,
        contactName: contactName || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactExternalId: form.contactExternalId.trim() || undefined,
        source: form.source.trim() || undefined,
        tags: form.tags.trim() || undefined,
        workstream: form.workstream.trim() || undefined,
        dueAt: dueAtIso || undefined,
      };
      await onSubmit(payload);
      return;
    }

    const payload: UpdateTicketInput = {
      clientId: form.clientId,
      projectId: form.projectId || null,
      departmentId: form.departmentId || null,
      ticketType: form.ticketType,
      title: form.title.trim() || undefined,
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority || null,
      ticketPriority: form.ticketPriority || null,
      raisedBy: form.raisedBy.trim() || contactName || null,
      agentName: form.agentName.trim() || null,
      internalAgentName: form.internalAgentName.trim() || null,
      contactName: contactName || null,
      contactEmail: form.contactEmail.trim() || null,
      contactExternalId: form.contactExternalId.trim() || null,
      source: form.source.trim() || null,
      tags: form.tags.trim() || null,
      workstream: form.workstream.trim() || null,
      dueAt: dueAtIso,
    };
    await onSubmit(payload);
  }

  const showImportMeta = mode === 'edit' && initial;
  const sectionClass =
    'space-y-5 rounded-xl border border-border/60 bg-card p-5';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={readOnly} className="min-w-0 space-y-6 border-0 p-0">
        <section className={sectionClass}>
          <h3 className="text-sm font-semibold text-navy">Core</h3>
          <FormField
            label="Client"
            htmlFor="ticket-client"
            error={errors.clientId}
            required
          >
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

          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <FormField
              label="Project"
              htmlFor="ticket-project"
              hint="Needed so the team can see this ticket and log time"
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
            <FormField
              label="Group"
              htmlFor="ticket-department"
              hint="Same as Department"
            >
              <Select
                id="ticket-department"
                value={form.departmentId}
                onChange={(e) => setField('departmentId', e.target.value)}
              >
                <option value="">No group</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Reference"
              htmlFor="ticket-reference"
              error={errors.reference}
              required={mode === 'create'}
            >
              <Input
                id="ticket-reference"
                value={form.reference}
                onChange={(e) => setField('reference', e.target.value)}
                placeholder="1103"
                invalid={Boolean(errors.reference)}
                required={mode === 'create'}
                disabled={mode === 'edit'}
                readOnly={mode === 'edit'}
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
                {TICKET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TICKET_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

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

          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <FormField label="Priority" htmlFor="ticket-priority">
              <Select
                id="ticket-priority"
                value={form.priority}
                onChange={(e) =>
                  setField('priority', e.target.value as TicketPriority | '')
                }
              >
                <option value="">None</option>
                {(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map(
                  (p) => (
                    <option key={p} value={p}>
                      {TICKET_PRIORITY_LABELS[p]}
                    </option>
                  ),
                )}
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="ticket-status">
              <Select
                id="ticket-status"
                value={form.status}
                onChange={(e) =>
                  setField('status', e.target.value as TicketStatus)
                }
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TICKET_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </section>

        <section className={sectionClass}>
          <h3 className="text-sm font-semibold text-navy">People</h3>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <FormField label="Agent" htmlFor="ticket-agent">
              <Input
                id="ticket-agent"
                value={form.agentName}
                onChange={(e) => setField('agentName', e.target.value)}
                placeholder="Assigned agent"
              />
            </FormField>
            <FormField label="Internal agent" htmlFor="ticket-internal-agent">
              <Input
                id="ticket-internal-agent"
                value={form.internalAgentName}
                onChange={(e) => setField('internalAgentName', e.target.value)}
                placeholder="Internal agent"
              />
            </FormField>
            <FormField label="Raised by" htmlFor="ticket-raised-by">
              <Input
                id="ticket-raised-by"
                value={form.raisedBy}
                onChange={(e) => setField('raisedBy', e.target.value)}
                placeholder="Name or email"
              />
            </FormField>
            <FormField label="Contact name" htmlFor="ticket-contact-name">
              <Input
                id="ticket-contact-name"
                value={form.contactName}
                onChange={(e) => setField('contactName', e.target.value)}
                placeholder="Dilip Halai"
              />
            </FormField>
            <FormField label="Contact email" htmlFor="ticket-contact-email">
              <Input
                id="ticket-contact-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setField('contactEmail', e.target.value)}
                placeholder="name@client.gov.uk"
              />
            </FormField>
          </div>
        </section>

        <section className={sectionClass}>
          <h3 className="text-sm font-semibold text-navy">Extra details</h3>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <FormField label="Ticket priority" htmlFor="ticket-priority-code">
              <Select
                id="ticket-priority-code"
                value={form.ticketPriority}
                onChange={(e) =>
                  setField(
                    'ticketPriority',
                    e.target.value as TicketPriorityCode | '',
                  )
                }
              >
                <option value="">None</option>
                {TICKET_PRIORITY_CODES.map((p) => (
                  <option key={p} value={p}>
                    {TICKET_PRIORITY_CODE_LABELS[p]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Due by" htmlFor="ticket-due">
              <Input
                id="ticket-due"
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setField('dueAt', e.target.value)}
              />
            </FormField>
            <FormField label="Source" htmlFor="ticket-source">
              <Input
                id="ticket-source"
                value={form.source}
                onChange={(e) => setField('source', e.target.value)}
                placeholder="Portal, Email…"
              />
            </FormField>
            <FormField label="Workstream" htmlFor="ticket-workstream">
              <Input
                id="ticket-workstream"
                value={form.workstream}
                onChange={(e) => setField('workstream', e.target.value)}
              />
            </FormField>
            <FormField label="Tags" htmlFor="ticket-tags">
              <Input
                id="ticket-tags"
                value={form.tags}
                onChange={(e) => setField('tags', e.target.value)}
              />
            </FormField>
          </div>

          {form.contactExternalId.trim() ||
          (mode === 'edit' && initial?.contactExternalId) ? (
            <details className="rounded-lg border border-border/50 bg-navy/[0.02] px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-navy">
                Advanced
              </summary>
              <div className="mt-3 pb-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-navy/45">
                  Contact Internal ID
                </p>
                <p className="mt-0.5 font-mono text-sm text-navy">
                  {form.contactExternalId.trim() ||
                    initial?.contactExternalId ||
                    '—'}
                </p>
                <p className="mt-1 text-xs text-slate">
                  From import — used only for matching contacts. Not editable
                  here.
                </p>
              </div>
            </details>
          ) : null}
        </section>

        {showImportMeta ? (
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold text-navy">
              Timestamps & response times
            </h3>
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate">Created</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatStamp(initial.openedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Resolved</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatStamp(initial.resolvedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Closed</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatStamp(initial.closedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Initial response</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatStamp(initial.initialResponseAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate">First response</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatDurationSeconds(initial.firstResponseSeconds)}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Resolution time</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatDurationSeconds(initial.resolutionSeconds)}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        {!hideCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
        ) : null}
        {readOnly ? null : (
          <Button type="submit" loading={submitting} disabled={submitting}>
            {mode === 'create' ? 'Create ticket' : 'Save changes'}
          </Button>
        )}
      </div>
    </form>
  );
}
