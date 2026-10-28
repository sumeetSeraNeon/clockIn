'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EmptyState } from '@/components/common/EmptyState';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { TicketForm } from '@/components/tickets/TicketForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft } from '@/components/ui/icons';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDayLineTimeLabel } from '@/lib/entry-display';
import { formatHoursMinutes } from '@/lib/format-duration';
import { getErrorMessage } from '@/lib/get-error-message';
import { usePermissions } from '@/lib/use-permissions';
import type {
  Client,
  Paginated,
  Project,
  Ticket,
  TicketDepartmentOption,
  TicketStatus,
  UpdateTicketInput,
} from '@/types/api';
import {
  TICKET_PRIORITY_CODE_LABELS,
  TICKET_STATUS_LABELS,
  type TicketPriorityCode,
} from '@/types/api';

type TicketTab = 'overview' | 'time';

function statusLabel(status: string) {
  return (
    TICKET_STATUS_LABELS[status as TicketStatus] ?? status.replace(/_/g, ' ')
  );
}

function formatEntryDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function lineStatusVariant(
  status: string,
): 'neutral' | 'warning' | 'success' | 'danger' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'submitted') return 'warning';
  return 'neutral';
}

/**
 * Ticket detail — Overview / Time tabs.
 * Time tab shows submitted + approved only (never draft).
 */
export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const ticketId = String(params.id ?? '');
  const { can } = usePermissions();
  const canEdit = can('ticket', 'edit');
  const canTrackTime = can('time_entry', 'edit');
  const canViewClients = can('client', 'view');

  const [tab, setTab] = useState<TicketTab>('overview');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<TicketDepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await api<Ticket>(`/tickets/${ticketId}`);
      setTicket(detail);

      const [clientsRes, projectsRes, departmentsRes] = await Promise.all([
        canViewClients || canEdit
          ? api<Paginated<Client>>('/clients?pageSize=100&status=active').catch(
              () => ({ data: [] as Client[] }),
            )
          : Promise.resolve({ data: [] as Client[] }),
        api<Paginated<Project>>('/projects?pageSize=100&status=active').catch(
          () => ({ data: [] as Project[] }),
        ),
        api<{ data: TicketDepartmentOption[] }>('/tickets/departments').catch(
          () => ({ data: [] as TicketDepartmentOption[] }),
        ),
      ]);
      setClients(clientsRes.data ?? []);
      setProjects(projectsRes.data ?? []);
      setDepartments(departmentsRes.data ?? []);
    } catch (err) {
      setTicket(null);
      setError(getErrorMessage(err, 'Could not load ticket'));
    } finally {
      setLoading(false);
    }
  }, [ticketId, canViewClients, canEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientName = useMemo(() => {
    if (!ticket) return null;
    return clients.find((c) => c.id === ticket.clientId)?.name ?? null;
  }, [ticket, clients]);

  const projectName = useMemo(() => {
    if (!ticket?.projectId) return null;
    return projects.find((p) => p.id === ticket.projectId)?.name ?? null;
  }, [ticket, projects]);

  const pendingMinutes = ticket?.minutesByStatus?.submitted ?? 0;
  const approvedMinutes = ticket?.loggedMinutes ?? 0;
  const timeEntries = ticket?.timeEntries ?? [];

  async function handleSave(values: UpdateTicketInput) {
    if (!ticket) return;
    setSubmitting(true);
    try {
      const updated = await api<Ticket>(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: values,
      });
      toast.success('Ticket updated');
      await load();
      setTicket((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save ticket'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleTrack() {
    if (!ticket) return;
    if (!ticket.projectId) {
      toast.error(
        'Assign a project on this ticket before adding time.',
      );
      return;
    }
    const qs = new URLSearchParams({
      add: '1',
      ticketId: ticket.id,
      projectId: ticket.projectId,
      clientId: ticket.clientId,
    });
    router.push(`/time?${qs.toString()}`);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <ListSkeleton rows={8} />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 pl-1"
          onClick={() => router.push('/tickets')}
        >
          <IconChevronLeft className="h-4 w-4" />
          Tickets
        </Button>
        <EmptyState
          title="Ticket not found"
          description={error || 'This ticket is not available.'}
          actionLabel="Back to tickets"
          onAction={() => router.push('/tickets')}
        />
      </div>
    );
  }

  const tabs: { id: TicketTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'time', label: 'Time' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-1 gap-1.5 pl-1"
            onClick={() => router.push('/tickets')}
          >
            <IconChevronLeft className="h-4 w-4" />
            Tickets
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-navy">
              {ticket.reference}
            </h1>
            <Badge variant="neutral">{statusLabel(ticket.status)}</Badge>
            {ticket.ticketPriority ? (
              <Badge variant="neutral">
                {TICKET_PRIORITY_CODE_LABELS[
                  ticket.ticketPriority as TicketPriorityCode
                ] ?? ticket.ticketPriority.toUpperCase()}
              </Badge>
            ) : null}
          </div>
          {ticket.title ? (
            <p className="mt-1 text-sm text-slate">{ticket.title}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[clientName, projectName, ticket.department?.name]
              .filter(Boolean)
              .map((label) => (
                <span
                  key={String(label)}
                  className="inline-flex rounded-md border border-navy/10 bg-navy/[0.03] px-2 py-0.5 text-xs text-navy"
                >
                  {label}
                </span>
              ))}
          </div>
          {ticket.dueAt ? (
            <p className="mt-2 text-xs text-slate">
              Due{' '}
              {new Date(ticket.dueAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canTrackTime ? (
            <Button type="button" onClick={handleTrack}>
              Add time
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-navy/10">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition',
              tab === id
                ? 'border-b-2 border-coral text-coral'
                : 'text-slate hover:text-navy',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <section className="max-w-4xl space-y-3">
          <p className="text-sm text-slate">
            {canEdit
              ? 'Update core details, people, and extra fields.'
              : 'Ticket details (view only).'}
          </p>
          <TicketForm
            mode="edit"
            initial={ticket}
            clients={clients}
            projects={projects}
            departments={departments}
            submitting={submitting}
            readOnly={!canEdit}
            hideCancel
            onSubmit={(values) => handleSave(values as UpdateTicketInput)}
            onCancel={() => router.push('/tickets')}
          />
        </section>
      ) : null}

      {tab === 'time' ? (
        <section className="space-y-4">
          <p className="text-sm text-slate">
            Submitted and approved time linked to this ticket only. Draft time
            is not shown.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <p>
              <span className="text-slate">Approved </span>
              <span className="font-medium tabular-nums text-ink">
                {formatHoursMinutes(approvedMinutes)}
              </span>
            </p>
            <p>
              <span className="text-slate">Pending </span>
              <span className="font-medium tabular-nums text-ink">
                {formatHoursMinutes(pendingMinutes)}
              </span>
            </p>
          </div>

          {timeEntries.length === 0 ? (
            <EmptyState
              title="No submitted time yet"
              description={
                canTrackTime
                  ? 'Use Add time to log hours against this ticket, then submit from Timesheet.'
                  : 'Time appears here after it is submitted for approval.'
              }
              actionLabel={canTrackTime ? 'Add time' : undefined}
              onAction={canTrackTime ? handleTrack : undefined}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs font-medium uppercase tracking-wide text-navy/55">
                    <th className="px-3 py-2.5">Person</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Time</th>
                    <th className="px-3 py-2.5">Task</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((row) => (
                    <tr
                      key={row.lineId}
                      className="border-b border-border/40 last:border-b-0"
                    >
                      <td className="px-3 py-2.5 text-ink">{row.userName}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate">
                        {formatEntryDay(row.entryDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-navy">
                        {formatDayLineTimeLabel(row)}
                      </td>
                      <td className="px-3 py-2.5 text-slate">
                        {row.taskName || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={lineStatusVariant(row.status)}>
                          {statusLabel(row.status)}
                        </Badge>
                      </td>
                      <td className="max-w-[14rem] truncate px-3 py-2.5 text-slate">
                        {row.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
