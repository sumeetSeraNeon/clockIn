'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClientForm } from '@/components/clients/ClientForm';
import { ClientsTable } from '@/components/clients/ClientsTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SearchField } from '@/components/common/SearchField';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { ImportModal } from '@/components/import/ImportModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { getErrorMessage } from '@/lib/get-error-message';
import { useClients } from '@/lib/use-clients';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePermissions } from '@/lib/use-permissions';
import type {
  Client,
  ClientStatus,
  CreateClientInput,
  MemberSummary,
  Paginated,
  UpdateClientInput,
} from '@/types/api';

type StatusFilter = ClientStatus | 'all';
type ModalMode = 'create' | 'edit' | null;

/**
 * Clients list — status filter + server-side name/code search (`q`).
 */
export default function ClientsPage() {
  const toast = useToast();
  const { me } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('client', 'edit');
  const canViewMembers = can('member', 'view');
  const orgCurrency = me?.organisation?.currency ?? 'GBP';

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('active');
  const [nameQuery, setNameQuery] = useState('');
  const debouncedQ = useDebouncedValue(nameQuery.trim());
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [archiving, setArchiving] = useState<Client | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [members, setMembers] = useState<MemberSummary[]>([]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const { data, total, totalPages, pageSize, loading, error, reload } =
    useClients({
      page,
      pageSize: 20,
      status,
      q: debouncedQ,
    });
  useEffect(() => {
    if (!canViewMembers) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    async function loadMembers() {
      try {
        const result = await api<Paginated<MemberSummary>>(
          '/members?pageSize=100&status=active',
        );
        if (!cancelled) setMembers(result.data ?? []);
      } catch {
        if (!cancelled) setMembers([]);
      }
    }
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [canViewMembers]);

  const membersById = useMemo(() => {
    const map = new Map<string, MemberSummary>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalMode('create');
  }, []);

  const openEdit = useCallback((client: Client) => {
    setEditing(client);
    setModalMode('edit');
  }, []);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalMode(null);
    setEditing(null);
  }, [submitting]);

  async function handleSubmit(values: CreateClientInput | UpdateClientInput) {
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api<Client>('/clients', {
          method: 'POST',
          body: values,
        });
        toast.success('Client created');
      } else if (modalMode === 'edit' && editing) {
        await api<Client>(`/clients/${editing.id}`, {
          method: 'PATCH',
          body: values,
        });
        toast.success('Client updated');
      }
      setModalMode(null);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save client'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!archiving) return;
    setArchiveLoading(true);
    try {
      await api(`/clients/${archiving.id}`, { method: 'DELETE' });
      toast.success(`Archived ${archiving.name}`);
      setArchiving(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not archive client'));
    } finally {
      setArchiveLoading(false);
    }
  }

  const hasSearch = Boolean(debouncedQ);
  const emptyTitle = hasSearch
    ? 'No matching clients'
    : status === 'all'
      ? canEdit
        ? 'No clients yet'
        : 'No clients for your work yet'
      : `No ${status} clients`;
  const emptyDescription = hasSearch
    ? 'Try another search, or clear the search box.'
    : canEdit
      ? 'Add your first client to start attaching projects and time.'
      : status === 'all'
        ? 'Clients appear here when you have tasks on their projects.'
        : 'Nothing matches this filter.';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Clients"
        description="Organisations you deliver work for."
        helpKey="clients"
        actions={
          canEdit ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setImportOpen(true)}
              >
                Import
              </Button>
              <Button type="button" onClick={openCreate}>
                New client
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate">
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </Select>
          </label>
        </div>
        <SearchField
          value={nameQuery}
          onChange={setNameQuery}
          label="Search"
          placeholder="Client name or code"
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
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={
            canEdit && status !== 'archived' && !hasSearch
              ? 'New client'
              : undefined
          }
          onAction={canEdit && !hasSearch ? openCreate : undefined}
        />
      ) : (
        <>
          <ClientsTable
            clients={data}
            membersById={membersById}
            canEdit={canEdit}
            onEdit={openEdit}
            onArchive={setArchiving}
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
        open={modalMode !== null}
        title={modalMode === 'create' ? 'New client' : 'Edit client'}
        description={
          modalMode === 'create'
            ? 'Creates a client in your organisation.'
            : 'Updates this client. Archive from the row menu if needed.'
        }
        onClose={closeModal}
      >
        <ClientForm
          mode={modalMode === 'edit' ? 'edit' : 'create'}
          initial={editing}
          members={members}
          orgCurrency={orgCurrency}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <ImportModal
        open={importOpen && canEdit}
        kind="clients"
        onClose={() => setImportOpen(false)}
        onImported={reload}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Archive client?"
        description={
          archiving
            ? `${archiving.name} will be marked archived. You can still find it with the Archived filter.`
            : ''
        }
        confirmLabel="Archive"
        danger
        loading={archiveLoading}
        onConfirm={() => void handleArchive()}
        onCancel={() => {
          if (!archiveLoading) setArchiving(null);
        }}
      />
    </div>
  );
}
