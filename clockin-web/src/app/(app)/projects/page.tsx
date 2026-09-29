'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { ProjectsTable } from '@/components/projects/ProjectsTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
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
import { useProjects } from '@/lib/use-projects';
import { usePermissions } from '@/lib/use-permissions';
import { isMemberOnlyRole } from '@/lib/app-nav';
import type {
  Client,
  CreateProjectInput,
  MemberSummary,
  Paginated,
  Project,
  ProjectStatus,
  UpdateProjectInput,
} from '@/types/api';

type StatusFilter = ProjectStatus | 'all';
type ModalMode = 'create' | 'edit' | null;

/**
 * List 6 — Projects CRUD (copy of Clients template).
 */
export default function ProjectsPage() {
  const toast = useToast();
  const { can, highestRole } = usePermissions();
  const canEdit = can('project', 'edit');
  const canViewClients = can('client', 'view');
  const canViewMembers = can('member', 'view');
  const canSetBillable = can('billable', 'set');
  /** FINAL FIX 8 — commercial strip is member-only, not “lacks edit” */
  const isMember = isMemberOnlyRole(highestRole);
  const showBillable = !isMember;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('active');
  const [clientId, setClientId] = useState<string | 'all'>('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [archiving, setArchiving] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const { data, total, totalPages, pageSize, loading, error, reload } =
    useProjects({ page, pageSize: 20, status, clientId });

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      try {
        let clientsData: Client[] = [];
        if (canViewClients) {
          try {
            const clientsRes = await api<Paginated<Client>>(
              '/clients?pageSize=100&status=active',
            );
            clientsData = clientsRes.data ?? [];
          } catch {
            clientsData = [];
          }
        }
        let membersData: MemberSummary[] = [];
        if (canViewMembers) {
          try {
            const membersRes = await api<Paginated<MemberSummary>>(
              '/members?pageSize=100&status=active',
            );
            membersData = membersRes.data ?? [];
          } catch {
            membersData = [];
          }
        }
        if (!cancelled) {
          setMembers(membersData);
          setClients(clientsData);
        }
      } catch {
        if (!cancelled) {
          setMembers([]);
          setClients([]);
        }
      }
    }

    void loadLookups();
    return () => {
      cancelled = true;
    };
  }, [canViewMembers, canViewClients]);

  const membersById = useMemo(() => {
    const map = new Map<string, MemberSummary>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalMode('create');
  }, []);

  const openEdit = useCallback((project: Project) => {
    setEditing(project);
    setModalMode('edit');
  }, []);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalMode(null);
    setEditing(null);
  }, [submitting]);

  async function handleSubmit(
    values: CreateProjectInput | UpdateProjectInput,
  ) {
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api<Project>('/projects', { method: 'POST', body: values });
        toast.success('Project created');
      } else if (modalMode === 'edit' && editing) {
        await api<Project>(`/projects/${editing.id}`, {
          method: 'PATCH',
          body: values,
        });
        toast.success('Project updated');
      }
      setModalMode(null);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save project'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!archiving) return;
    setArchiveLoading(true);
    try {
      await api(`/projects/${archiving.id}`, { method: 'DELETE' });
      toast.success(`Archived ${archiving.name}`);
      setArchiving(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not archive project'));
    } finally {
      setArchiveLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Projects"
        description={
          isMember
            ? 'Projects you are assigned to. Open one to see your tasks.'
            : 'Delivery work under each client.'
        }
        actions={
          canEdit ? (
            <Button type="button" onClick={openCreate}>
              New project
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
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </Select>
        </label>

        {!isMember && (canViewClients || canViewMembers) ? (
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
            status === 'all' && clientId === 'all'
              ? isMember
                ? 'No projects assigned to you yet'
                : 'No projects yet'
              : 'No projects match'
          }
          description={
            isMember
              ? status === 'all' && clientId === 'all'
                ? 'You will see projects here once a task on them is assigned to you.'
                : 'Nothing matches these filters.'
              : canEdit
                ? 'Create a project under a client to track delivery and time.'
                : 'Nothing matches these filters.'
          }
          actionLabel={
            canEdit && clients.length > 0 ? 'New project' : undefined
          }
          onAction={canEdit && clients.length > 0 ? openCreate : undefined}
        />
      ) : (
        <>
          <ProjectsTable
            projects={data}
            clientsById={clientsById}
            membersById={membersById}
            canEdit={canEdit}
            memberView={isMember}
            showOpen
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
        title={modalMode === 'create' ? 'New project' : 'Edit project'}
        description={
          modalMode === 'create'
            ? 'Attach the project to a client in your organisation.'
            : 'Update project details. Archive from the row menu if needed.'
        }
        onClose={closeModal}
      >
        <ProjectForm
          mode={modalMode === 'edit' ? 'edit' : 'create'}
          initial={editing}
          clients={clients}
          members={members}
          submitting={submitting}
          canSetBillable={canSetBillable}
          showBillable={showBillable}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Archive project?"
        description={
          archiving
            ? `${archiving.name} will be marked archived. Filter by Archived to find it again.`
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
