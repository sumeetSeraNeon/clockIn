'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImportModal } from '@/components/import/ImportModal';
import { TicketForm } from '@/components/tickets/TicketForm';
import { TicketsTable } from '@/components/tickets/TicketsTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SearchField } from '@/components/common/SearchField';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/get-error-message';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTickets } from '@/lib/use-tickets';
import { usePermissions } from '@/lib/use-permissions';
import type {
  Client,
  CreateTicketInput,
  Paginated,
  Project,
  Ticket,
  TicketDepartmentOption,
  TicketPriority,
  TicketStatus,
  TicketType,
  UpdateTicketInput,
} from '@/types/api';
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  TICKET_TYPE_LABELS,
  TICKET_TYPES,
} from '@/types/api';

type StatusFilter = TicketStatus | 'all';
type TypeFilter = TicketType | 'all';
type PriorityFilter = TicketPriority | 'all';

/**
 * Tickets list — filters + server-side reference/title search (`q`).
 * Freshdesk Excel import for ticket:edit.
 */
export default function TicketsPage() {
  const router = useRouter();
  const toast = useToast();
  const { can } = usePermissions();
  const canEdit = can('ticket', 'edit');
  const canViewClients = can('client', 'view');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [clientId, setClientId] = useState<string | 'all'>('all');
  const [ticketType, setTicketType] = useState<TypeFilter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [nameQuery, setNameQuery] = useState('');
  const debouncedQ = useDebouncedValue(nameQuery.trim());
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<TicketDepartmentOption[]>([]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const { data, total, totalPages, pageSize, loading, error, reload } =
    useTickets({
      page,
      pageSize: 20,
      status,
      clientId,
      ticketType,
      priority,
      q: debouncedQ,
    });

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      let clientsData: Client[] = [];
      let projectsData: Project[] = [];
      let departmentsData: TicketDepartmentOption[] = [];

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

      try {
        const departmentsRes = await api<{ data: TicketDepartmentOption[] }>(
          '/tickets/departments',
        );
        departmentsData = departmentsRes.data ?? [];
      } catch {
        departmentsData = [];
      }

      if (!cancelled) {
        setClients(clientsData);
        setProjects(projectsData);
        setDepartments(departmentsData);
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
    setCreating(true);
  }, []);

  const openTicket = useCallback(
    (ticket: Ticket) => {
      router.push(`/tickets/${ticket.id}`);
    },
    [router],
  );

  const closeModal = useCallback(() => {
    if (submitting) return;
    setCreating(false);
  }, [submitting]);

  async function handleSubmit(values: CreateTicketInput | UpdateTicketInput) {
    setSubmitting(true);
    try {
      const created = await api<Ticket>('/tickets', {
        method: 'POST',
        body: values as CreateTicketInput,
      });
      toast.success('Ticket created');
      setCreating(false);
      reload();
      router.push(`/tickets/${created.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save ticket'));
    } finally {
      setSubmitting(false);
    }
  }

  const hasSearch = Boolean(debouncedQ);
  const filtersClear =
    status === 'all' &&
    clientId === 'all' &&
    ticketType === 'all' &&
    priority === 'all' &&
    !hasSearch;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tickets"
        description={
          canEdit
            ? 'Incidents, changes, and service requests — including imports.'
            : 'Tickets on your projects (view only).'
        }
        helpKey="tickets"
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setImportOpen(true)}
              >
                Import
              </Button>
              <Button type="button" onClick={openCreate}>
                New ticket
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate">
            Status
            <Select
              className="min-w-[180px]"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as StatusFilter);
              }}
            >
              <option value="all">All</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </label>

          {canViewClients || canEdit ? (
            <label className="flex flex-col gap-1 text-xs text-slate">
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

          <label className="flex flex-col gap-1 text-xs text-slate">
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
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TICKET_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate">
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
        <SearchField
          value={nameQuery}
          onChange={setNameQuery}
          label="Search"
          placeholder="Reference or title"
        />
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
            hasSearch
              ? 'No matching tickets'
              : filtersClear
                ? 'No tickets on your projects yet'
                : 'No tickets match'
          }
          description={
            hasSearch
              ? 'Try another search, or clear the search box.'
              : filtersClear
                ? canEdit
                  ? 'Import an export or raise a ticket against a client.'
                  : 'You will see tickets for projects you are assigned to.'
                : 'Nothing matches these filters.'
          }
          actionLabel={
            canEdit && clients.length > 0 && !hasSearch
              ? 'New ticket'
              : undefined
          }
          onAction={
            canEdit && clients.length > 0 && !hasSearch
              ? openCreate
              : undefined
          }
        />
      ) : (
        <>
          <TicketsTable
            tickets={data}
            clientsById={clientsById}
            projectsById={projectsById}
            canEdit={canEdit}
            onOpen={openTicket}
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
        open={creating && canEdit}
        title="New ticket"
        description="Reference is unique per organisation."
        onClose={closeModal}
      >
        <TicketForm
          mode="create"
          clients={clients}
          projects={projects}
          departments={departments}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <ImportModal
        open={importOpen && canEdit}
        kind="tickets"
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          reload();
          void api<{ data: TicketDepartmentOption[] }>('/tickets/departments')
            .then((res) => setDepartments(res.data ?? []))
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
