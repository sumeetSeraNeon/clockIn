'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { ProjectTeamPanel } from '@/components/projects/ProjectTeamPanel';
import { TaskActivityPanel } from '@/components/tasks/TaskActivityPanel';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TasksTable } from '@/components/tasks/TasksTable';
import { TicketsTable } from '@/components/tickets/TicketsTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconChevronLeft } from '@/components/ui/icons';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { isMemberOnlyRole } from '@/lib/app-nav';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format-money';
import { getErrorMessage } from '@/lib/get-error-message';
import { useTickets } from '@/lib/use-tickets';
import { usePermissions } from '@/lib/use-permissions';
import type {
  Client,
  CreateTaskInput,
  MemberSummary,
  Paginated,
  Project,
  ProjectMember,
  Task,
  UpdateProjectInput,
  UpdateTaskInput,
} from '@/types/api';

type ProjectTab = 'tasks' | 'team' | 'tickets' | 'overview' | 'settings';

/**
 * Project detail — Clockify-style header + underline tabs (Tasks default).
 */
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const projectId = String(params.id ?? '');
  const { me } = useAuth();
  const { can, highestRole } = usePermissions();
  const canEditProject = can('project', 'edit');
  const canEditTasks = can('task', 'edit');
  const canViewMembers = can('member', 'view');
  const canViewClients = can('client', 'view');
  const canTrackTime = can('time_entry', 'edit');
  const canSetBillable = can('billable', 'set');
  const canViewRates = can('rate', 'view');
  const canEditRates = can('rate', 'edit');
  const canViewTickets = can('ticket', 'view');
  const isMember = isMemberOnlyRole(highestRole);
  const showBillable = !isMember;
  const orgCurrency = me?.organisation?.currency ?? 'GBP';

  const [tab, setTab] = useState<ProjectTab>('tasks');
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<MemberSummary[]>([]);
  const [orgMembers, setOrgMembers] = useState<MemberSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activityTask, setActivityTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [createNamePrefill, setCreateNamePrefill] = useState('');
  const [quickTaskName, setQuickTaskName] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [archiving, setArchiving] = useState<Task | null>(null);
  const [markingDone, setMarkingDone] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [markDoneLoading, setMarkDoneLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ticketsQuery = useTickets({
    page: 1,
    pageSize: 50,
    status: 'all',
    projectId: projectId || 'all',
    enabled: Boolean(projectId) && canViewTickets && tab === 'tickets',
  });

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const projectRes = await api<Project>(`/projects/${projectId}`);
      const taskParams = new URLSearchParams({
        projectId,
        pageSize: '100',
        status: 'open',
      });
      const [tasksRes, teamRes] = await Promise.all([
        api<Paginated<Task>>(`/tasks?${taskParams.toString()}`),
        api<ProjectMember[]>(`/projects/${projectId}/members`).catch(
          () => [] as ProjectMember[],
        ),
      ]);
      setProject(projectRes);
      setTasks(tasksRes.data ?? []);
      setTeamMembers(
        (teamRes ?? [])
          .filter((m) => m.status === 'active')
          .map((m) => m.membership)
          .filter(Boolean),
      );
    } catch {
      setProject(null);
      setTasks([]);
      setTeamMembers([]);
      setError('Project not found or you do not have access.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canEditProject) return;
    let cancelled = false;
    void (async () => {
      let clientsData: Client[] = [];
      let membersData: MemberSummary[] = [];
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
        setClients(clientsData);
        setOrgMembers(membersData);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEditProject, canViewClients, canViewMembers]);

  const manager =
    project?.owner?.user?.name || project?.owner?.user?.email || null;

  const projectsById = useMemo(
    () => new Map(project ? [[project.id, project] as const] : []),
    [project],
  );

  const membersById = useMemo(() => {
    const map = new Map<string, MemberSummary>();
    for (const m of teamMembers) map.set(m.id, m);
    return map;
  }, [teamMembers]);

  const projectList = useMemo(
    () => (project ? [project] : []),
    [project],
  );

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    if (project?.client) {
      map.set(project.client.id, {
        id: project.client.id,
        organisationId: project.organisationId,
        name: project.client.name,
        code: null,
        currency: project.client.currency,
        ownerId: null,
        status: 'active',
        externalRef: null,
        createdAt: '',
        updatedAt: '',
      });
    }
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [project, clients]);

  const formClients = useMemo(() => {
    if (clients.length > 0) return clients;
    const fromMap = project?.client
      ? [clientsById.get(project.client.id)!].filter(Boolean)
      : [];
    return fromMap;
  }, [clients, project, clientsById]);

  const formMembers = orgMembers.length > 0 ? orgMembers : teamMembers;

  const tabs = useMemo(() => {
    const list: { id: ProjectTab; label: string }[] = [
      { id: 'tasks', label: 'Tasks' },
      { id: 'team', label: 'Team' },
    ];
    if (canViewTickets) {
      list.push({ id: 'tickets', label: 'Tickets' });
    }
    list.push({ id: 'overview', label: 'Overview' });
    if (canEditProject) {
      list.push({ id: 'settings', label: 'Settings' });
    }
    return list;
  }, [canViewTickets, canEditProject]);

  useEffect(() => {
    if (tab === 'tickets' && !canViewTickets) setTab('tasks');
    if (tab === 'settings' && !canEditProject) setTab('tasks');
  }, [tab, canViewTickets, canEditProject]);

  function openCreateModal(prefill = '') {
    setCreateNamePrefill(prefill);
    setCreating(true);
  }

  function closeCreateModal() {
    if (submitting) return;
    setCreating(false);
    setCreateNamePrefill('');
  }

  function handleQuickAdd() {
    const name = quickTaskName.trim();
    if (!name) {
      toast.error('Enter a task name');
      return;
    }
    setQuickTaskName('');
    openCreateModal(name);
  }

  async function handleCreate(values: CreateTaskInput | UpdateTaskInput) {
    setSubmitting(true);
    try {
      await api<Task>('/tasks', {
        method: 'POST',
        body: values as CreateTaskInput,
      });
      toast.success('Task created');
      setCreating(false);
      setCreateNamePrefill('');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create task'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(values: CreateTaskInput | UpdateTaskInput) {
    if (!editing) return;
    setSubmitting(true);
    try {
      await api<Task>(`/tasks/${editing.id}`, {
        method: 'PATCH',
        body: values,
      });
      toast.success('Task updated');
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save task'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProject(values: UpdateProjectInput) {
    if (!project) return;
    setSavingProject(true);
    try {
      const updated = await api<Project>(`/projects/${project.id}`, {
        method: 'PATCH',
        body: values,
      });
      setProject(updated);
      toast.success('Project updated');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save project'));
    } finally {
      setSavingProject(false);
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
      await load();
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
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not archive task'));
    } finally {
      setArchiveLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 pl-1"
          onClick={() => router.push('/projects')}
        >
          <IconChevronLeft className="h-4 w-4" />
          Projects
        </Button>
        <EmptyState
          title="Project unavailable"
          description={error ?? 'Could not load this project.'}
          actionLabel="Back to projects"
          onAction={() => router.push('/projects')}
        />
      </div>
    );
  }

  const moneyCurrency = project.client?.currency || orgCurrency;
  const clientName = project.client?.name || null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-1 gap-1.5 pl-1"
          onClick={() => router.push('/projects')}
        >
          <IconChevronLeft className="h-4 w-4" />
          Projects
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-navy">
          {project.name}
        </h1>
        {clientName ? (
          <p className="mt-0.5 text-sm text-slate">{clientName}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate">
          {[
            project.code,
            statusLabel(project.status),
            manager ? `Manager: ${manager}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
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

      {tab === 'tasks' ? (
        <section className="space-y-4">
          <p className="text-sm text-slate">
            {canEditTasks
              ? 'Open tasks on this project. Anyone on the Team can log time; assignee is an optional primary owner.'
              : 'Open tasks on this project. You can log time to any of them.'}
          </p>

          {tasks.length === 0 ? (
            <EmptyState
              title="No open tasks"
              description={
                canEditTasks
                  ? 'Add your first task below and start tracking.'
                  : 'No open tasks on this project yet.'
              }
            />
          ) : (
            <TasksTable
              tasks={tasks}
              projectsById={projectsById}
              membersById={membersById}
              canEdit={canEditTasks}
              canTrackTime={canTrackTime}
              showBillable={showBillable}
              memberView={isMember}
              hideProjectColumn
              onTrack={(task) => setActivityTask(task)}
              onEdit={setEditing}
              onMarkDone={setMarkingDone}
              onArchive={setArchiving}
            />
          )}

          {canEditTasks ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-navy/10 pt-4">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-slate">
                Task name
                <Input
                  value={quickTaskName}
                  onChange={(e) => setQuickTaskName(e.target.value)}
                  placeholder="Enter task name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAdd();
                    }
                  }}
                />
              </label>
              <Button type="button" onClick={handleQuickAdd}>
                Add
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => openCreateModal('')}
              >
                More options
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'team' ? (
        <ProjectTeamPanel
          projectId={project.id}
          projectOwnerId={project.ownerId}
          projectName={project.name}
          clientId={project.clientId}
          clientName={project.client?.name ?? null}
          clientCurrency={project.client?.currency ?? null}
          canEdit={canEditProject}
          canViewOrgMembers={canViewMembers}
          canViewRates={canViewRates}
          canEditRates={canEditRates}
          orgCurrency={orgCurrency}
          showHeading={false}
          onTeamChange={() => void load()}
        />
      ) : null}

      {tab === 'tickets' && canViewTickets ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-slate">
              Tickets linked to this project.
            </p>
            <Link
              href="/tickets"
              className="text-sm font-medium text-navy underline-offset-2 hover:underline"
            >
              Open Tickets
            </Link>
          </div>
          {ticketsQuery.loading ? (
            <ListSkeleton rows={4} />
          ) : ticketsQuery.error ? (
            <p className="text-sm font-medium text-danger">
              {ticketsQuery.error}
            </p>
          ) : ticketsQuery.data.length === 0 ? (
            <EmptyState
              title="No tickets on this project"
              description="Tickets raised against this project appear here."
            />
          ) : (
            <TicketsTable
              tickets={ticketsQuery.data}
              clientsById={clientsById}
              projectsById={projectsById}
              canEdit={false}
              hideClientColumn
              hideProjectColumn
              onEdit={() => undefined}
              onAdvance={() => undefined}
            />
          )}
        </section>
      ) : null}

      {tab === 'overview' ? (
        <section className="space-y-4">
          <p className="text-sm text-slate">
            Status, dates, budget, and who manages this project.
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <OverviewField label="Status">
              {statusLabel(project.status)}
            </OverviewField>
            <OverviewField label="Manager">{manager || '—'}</OverviewField>
            <OverviewField label="Client">
              {clientName || '—'}
            </OverviewField>
            <OverviewField label="Code">{project.code || '—'}</OverviewField>
            <OverviewField label="Start">
              {formatDate(project.startDate)}
            </OverviewField>
            <OverviewField label="End">
              {formatDate(project.endDate)}
            </OverviewField>
            <OverviewField label="Budget (hours)">
              {formatBudgetHours(project.budgetHours)}
            </OverviewField>
            {canViewRates ? (
              <OverviewField label="Budget (value)">
                {project.budgetValue != null && project.budgetValue !== ''
                  ? formatMoney(project.budgetValue, moneyCurrency)
                  : '—'}
              </OverviewField>
            ) : null}
            {showBillable ? (
              <OverviewField label="Billable by default">
                {project.billableByDefault ? 'Yes' : 'No'}
              </OverviewField>
            ) : null}
          </dl>
        </section>
      ) : null}

      {tab === 'settings' && canEditProject ? (
        <section className="max-w-xl space-y-3">
          <p className="text-sm text-slate">
            Update project details. Archive from the Projects list if needed.
          </p>
          <ProjectForm
            mode="edit"
            initial={project}
            clients={formClients}
            members={formMembers}
            submitting={savingProject}
            canSetBillable={canSetBillable}
            showBillable={showBillable}
            onSubmit={async (values) => {
              await handleSaveProject(values as UpdateProjectInput);
            }}
            onCancel={() => setTab('overview')}
          />
        </section>
      ) : null}

      <TaskActivityPanel
        task={activityTask}
        open={Boolean(activityTask)}
        onClose={() => setActivityTask(null)}
        showBillable={showBillable}
        canStartTimer={Boolean(canTrackTime && activityTask)}
      />

      <Modal
        open={creating}
        title="Add task"
        description={`Create a task on ${project.name}. Assignee must be on the project team.`}
        onClose={closeCreateModal}
      >
        <TaskForm
          mode="create"
          projects={projectList}
          members={teamMembers}
          fixedProjectId={project.id}
          defaultName={createNamePrefill}
          submitting={submitting}
          canSetBillable={canSetBillable}
          showBillable={showBillable}
          onSubmit={handleCreate}
          onCancel={closeCreateModal}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit task"
        description="Update task details. Mark done or archive from the row."
        onClose={() => {
          if (!submitting) setEditing(null);
        }}
      >
        {editing ? (
          <TaskForm
            mode="edit"
            initial={editing}
            projects={projectList}
            members={teamMembers}
            fixedProjectId={project.id}
            submitting={submitting}
            canSetBillable={canSetBillable}
            showBillable={showBillable}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

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

function OverviewField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-navy/55">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-navy">{children}</dd>
    </div>
  );
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatBudgetHours(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return `${value}h`;
}
