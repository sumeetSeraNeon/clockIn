'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TaskActivityPanel } from '@/components/tasks/TaskActivityPanel';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TasksTable } from '@/components/tasks/TasksTable';
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
import { getErrorMessage } from '@/lib/get-error-message';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTasks } from '@/lib/use-tasks';
import { usePermissions } from '@/lib/use-permissions';
import { isMemberOnlyRole } from '@/lib/app-nav';
import type {
  CreateTaskInput,
  MemberSummary,
  Paginated,
  Project,
  Task,
  TaskStatus,
  UpdateTaskInput,
} from '@/types/api';

type StatusFilter = TaskStatus | 'all';
type ModalMode = 'create' | 'edit' | null;

/**
 * Tasks list — filters + server-side name search (`q`).
 */
export default function TasksPage() {
  const toast = useToast();
  const { can, highestRole } = usePermissions();
  const canEdit = can('task', 'edit');
  const canTrackTime = can('time_entry', 'edit');
  const canViewMembers = can('member', 'view');
  const canSetBillable = can('billable', 'set');
  /** FINAL FIX 8 — commercial strip is member-only, not “lacks edit” */
  const isMember = isMemberOnlyRole(highestRole);
  const showBillable = !isMember;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [projectId, setProjectId] = useState<string | 'all'>('all');
  const [assigneeId, setAssigneeId] = useState<string | 'all'>('all');
  const [nameQuery, setNameQuery] = useState('');
  const debouncedQ = useDebouncedValue(nameQuery.trim());
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [activityTask, setActivityTask] = useState<Task | null>(null);
  const [archiving, setArchiving] = useState<Task | null>(null);
  const [markingDone, setMarkingDone] = useState<Task | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [markDoneLoading, setMarkDoneLoading] = useState(false);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const { data, total, totalPages, pageSize, loading, error, reload } =
    useTasks({
      page,
      pageSize: 20,
      status,
      projectId,
      assigneeId,
      q: debouncedQ,
    });

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      try {
        let projectsData: Project[] = [];
        try {
          const projectsRes = await api<Paginated<Project>>(
            '/projects?pageSize=100&status=active',
          );
          projectsData = projectsRes.data ?? [];
        } catch {
          projectsData = [];
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
          setProjects(projectsData);
        }
      } catch {
        if (!cancelled) {
          setMembers([]);
          setProjects([]);
        }
      }
    }

    void loadLookups();
    return () => {
      cancelled = true;
    };
  }, [canViewMembers]);

  const membersById = useMemo(() => {
    const map = new Map<string, MemberSummary>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalMode('create');
  }, []);

  const openEdit = useCallback((task: Task) => {
    setEditing(task);
    setModalMode('edit');
  }, []);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalMode(null);
    setEditing(null);
  }, [submitting]);

  async function handleSubmit(values: CreateTaskInput | UpdateTaskInput) {
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api<Task>('/tasks', { method: 'POST', body: values });
        toast.success('Task created');
      } else if (modalMode === 'edit' && editing) {
        await api<Task>(`/tasks/${editing.id}`, {
          method: 'PATCH',
          body: values,
        });
        toast.success('Task updated');
      }
      setModalMode(null);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save task'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkDone() {
    if (!markingDone) return;
    setMarkDoneLoading(true);
    try {
      await api<Task>(`/tasks/${markingDone.id}`, {
        method: 'PATCH',
        body: { status: 'done' } satisfies UpdateTaskInput,
      });
      toast.success(`Marked ${markingDone.name} done`);
      setMarkingDone(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not mark task done'));
    } finally {
      setMarkDoneLoading(false);
    }
  }

  async function handleArchive() {
    if (!archiving) return;
    setArchiveLoading(true);
    try {
      await api(`/tasks/${archiving.id}`, { method: 'DELETE' });
      toast.success(`Archived ${archiving.name}`);
      setArchiving(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not archive task'));
    } finally {
      setArchiveLoading(false);
    }
  }

  const hasSearch = Boolean(debouncedQ);
  const filtersClear =
    status === 'all' &&
    projectId === 'all' &&
    assigneeId === 'all' &&
    !hasSearch;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tasks"
        description="Work items under each project."
        helpKey="tasks"
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
                New task
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
              <option value="open">Open</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate">
            Project
            <Select
              className="min-w-[180px]"
              value={projectId}
              onChange={(e) => {
                setPage(1);
                setProjectId(e.target.value);
              }}
            >
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>

          {canViewMembers ? (
            <label className="flex flex-col gap-1 text-xs text-slate">
              Assignee
              <Select
                className="min-w-[180px]"
                value={assigneeId}
                onChange={(e) => {
                  setPage(1);
                  setAssigneeId(e.target.value);
                }}
              >
                <option value="all">Anyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user.name || m.user.email}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>
        <SearchField
          value={nameQuery}
          onChange={setNameQuery}
          label="Search"
          placeholder="Task name"
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
              ? 'No matching tasks'
              : filtersClear
                ? canEdit
                  ? 'No tasks yet'
                  : 'No tasks assigned to you yet'
                : 'No tasks match'
          }
          description={
            hasSearch
              ? 'Try another search, or clear the search box.'
              : canEdit
                ? 'Create a task under a project to track delivery work.'
                : filtersClear
                  ? 'You will see tasks here once they are assigned to you.'
                  : 'Nothing matches these filters.'
          }
          actionLabel={
            canEdit && projects.length > 0 && !hasSearch
              ? 'New task'
              : undefined
          }
          onAction={
            canEdit && projects.length > 0 && !hasSearch
              ? openCreate
              : undefined
          }
        />
      ) : (
        <>
          <TasksTable
            tasks={data}
            projectsById={projectsById}
            membersById={membersById}
            canEdit={canEdit}
            canTrackTime={canTrackTime}
            showBillable={showBillable}
            memberView={isMember}
            onTrack={(task) => setActivityTask(task)}
            onEdit={openEdit}
            onMarkDone={setMarkingDone}
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

      <TaskActivityPanel
        task={activityTask}
        open={Boolean(activityTask)}
        onClose={() => setActivityTask(null)}
        showBillable={showBillable}
        canStartTimer={Boolean(canTrackTime && activityTask)}
      />

      <Modal
        open={modalMode !== null}
        title={modalMode === 'create' ? 'New task' : 'Edit task'}
        description={
          modalMode === 'create'
            ? 'Attach the task to a project in your organisation.'
            : 'Update task details. Mark done or archive from the row.'
        }
        onClose={closeModal}
      >
        <TaskForm
          mode={modalMode === 'edit' ? 'edit' : 'create'}
          initial={editing}
          projects={projects}
          members={members}
          submitting={submitting}
          canSetBillable={canSetBillable}
          showBillable={showBillable}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <ImportModal
        open={importOpen && canEdit}
        kind="tasks"
        onClose={() => setImportOpen(false)}
        onImported={reload}
      />

      <ConfirmDialog
        open={Boolean(markingDone)}
        title="Mark task done?"
        description={
          markingDone
            ? `${markingDone.name} will leave Open and show as Done. You can change status again from Edit if needed.`
            : ''
        }
        confirmLabel="Mark done"
        loading={markDoneLoading}
        onConfirm={() => void handleMarkDone()}
        onCancel={() => {
          if (!markDoneLoading) setMarkingDone(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Archive task?"
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
