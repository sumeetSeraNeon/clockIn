'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketForm } from '@/components/tickets/TicketForm';
import { TicketsTable } from '@/components/tickets/TicketsTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/get-error-message';
import { useTickets } from '@/lib/use-tickets';
import { usePermissions } from '@/lib/use-permissions';
import type {
  Client,
  CreateTicketInput,
  Paginated,
  Project,
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketType,
  UpdateTicketInput,
} from '@/types/api';
import { TICKET_NEXT_STATUS } from '@/types/api';

type StatusFilter = TicketStatus | 'all';
type TypeFilter = TicketType | 'all';
type PriorityFilter = TicketPriority | 'all';
type ModalMode = 'create' | 'edit' | null;

/**
 * List 8 — Tickets.
 * FINAL FIX 9 — ticket:edit gates New / Edit / Start (members view-only).
 */
export default function TicketsPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const canEdit = can('ticket', 'edit');
  const canViewClients = can('client', 'view');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [clientId, setClientId] = useState<string | 'all'>('all');
  const [ticketType, setTicketType] = useState<TypeFilter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const { data, total, totalPages, pageSize, loading, error, reload } =
    useTickets({ page, pageSize: 20, status, clientId, ticketType, priority });

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      let clientsData: Client[] = [];
      let projectsData: Project[] = [];

      if (canViewClients || canEdit) {
        try {
          const clientsRes = await api<Paginated<Client>>(
            '/clients?pageSize=100&status=active',
          );
          clientsData = clientsRes.data ?? [];
        } catch {
          clientsData = [];
        }
      }

      try {
        const projectsRes = await api<Paginated<Project>>(
          '/projects?pageSize=100&status=active',
        );
        projectsData = projectsRes.data ?? [];
      } catch {
        projectsData = [];
      }

      if (!cancelled) {
        setClients(clientsData);
        setProjects(projectsData);
      }
    }

    void loadLookups();
    return () => {
      cancelled = true;
    };
  }, [canViewClients, canEdit]);

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalMode('create');
  }, []);

  const openEdit = useCallback((ticket: Ticket) => {
    setEditing(ticket);
    setModalMode('edit');
  }, []);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalMode(null);
    setEditing(null);
  }, [submitting]);

  async function handleSubmit(
    values: CreateTicketInput | UpdateTicketInput,
  ) {
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api<Ticket>('/tickets', { method: 'POST', body: values });
        toast.success('Ticket created');
      } else if (modalMode === 'edit' && editing) {
        await api<Ticket>(`/tickets/${editing.id}`, {
          method: 'PATCH',
          body: values,
        });
        toast.success('Ticket updated');
      }
      setModalMode(null);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save ticket'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdvance(ticket: Ticket) {
    const next =
      TICKET_NEXT_STATUS[(ticket.status as TicketStatus) || 'open'];
    if (!next) return;
    try {
      await api<Ticket>(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: { status: next } satisfies UpdateTicketInput,
      });
      toast.success(`${ticket.reference} → ${next.replace(/_/g, ' ')}`);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update ticket status'));
    }
  }

  const filtersClear =
    status === 'all' &&
    clientId === 'all' &&
    ticketType === 'all' &&
    priority === 'all';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tickets"
        description={
          canEdit
            ? 'Incidents and service requests for clients.'
            : 'Tickets on your projects (view only).'
        }
        actions={
          canEdit ? (
            <Button type="button" onClick={openCreate}>
              New ticket
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate">
          Status
          <Select
            className="w-40"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as StatusFilter);
            }}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </Select>
        </label>

        {canViewClients || canEdit ? (
          <label className="flex items-center gap-2 text-sm text-slate">
            Client
            <Select
              className="min-w-[180px]"
              value={clientId}
              onChange={(e) => {
                setPage(1);
                setClientId(e.target.value);
              }}
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-slate">
          Type
          <Select
            className="min-w-[160px]"
            value={ticketType}
            onChange={(e) => {
              setPage(1);
              setTicketType(e.target.value as TypeFilter);
            }}
          >
            <option value="all">All types</option>
            <option value="incident">Incident</option>
            <option value="service_request">Service request</option>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate">
          Priority
          <Select
            className="w-36"
            value={priority}
            onChange={(e) => {
              setPage(1);
              setPriority(e.target.value as PriorityFilter);
            }}
          >
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </label>
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <div className="rounded-lg border border-border/80 bg-card px-5 py-6">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={reload}
          >
            Try again
          </Button>
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title={
            filtersClear
              ? 'No tickets on your projects yet'
              : 'No tickets match'
          }
          description={
            filtersClear
              ? canEdit
                ? 'Raise a ticket against a client when needed.'
                : 'You will see tickets for projects you are assigned to.'
              : 'Nothing matches these filters.'
          }
          actionLabel={
            canEdit && clients.length > 0 ? 'New ticket' : undefined
          }
          onAction={canEdit && clients.length > 0 ? openCreate : undefined}
        />
      ) : (
        <>
          <TicketsTable
            tickets={data}
            clientsById={clientsById}
            projectsById={projectsById}
            canEdit={canEdit}
            onEdit={openEdit}
            onAdvance={(t) => void handleAdvance(t)}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        open={modalMode !== null && canEdit}
        title={modalMode === 'create' ? 'New ticket' : 'Edit ticket'}
        description={
          modalMode === 'create'
            ? 'Reference is unique per organisation. Status starts as open.'
            : 'Status can only move forward: open → in progress → resolved → closed.'
        }
        onClose={closeModal}
      >
        <TicketForm
          mode={modalMode === 'edit' ? 'edit' : 'create'}
          initial={editing}
          clients={clients}
          projects={projects}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}
