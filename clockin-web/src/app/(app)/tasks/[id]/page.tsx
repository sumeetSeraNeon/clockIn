'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { TaskActivityPanel } from '@/components/tasks/TaskActivityPanel';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft } from '@/components/ui/icons';
import { api } from '@/lib/api-client';
import { isMemberOnlyRole } from '@/lib/app-nav';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/get-error-message';
import { usePermissions } from '@/lib/use-permissions';
import type {
  CreateTaskInput,
  MemberSummary,
  Paginated,
  Project,
  ProjectMember,
  Task,
  UpdateTaskInput,
} from '@/types/api';

type TaskTab = 'time' | 'overview' | 'settings';

function personLabel(
  person:
    | { user?: { name?: string | null; email?: string } | null }
    | null
    | undefined,
) {
  return person?.user?.name || person?.user?.email || null;
}

function formatHours(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Task detail — header + Time / Overview / Settings tabs (project-style).
 */
export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const taskId = String(params.id ?? '');
  const { can, highestRole } = usePermissions();
  const canEdit = can('task', 'edit');
  const canTrackTime = can('time_entry', 'edit');
  const canSetBillable = can('billable', 'set');
  const isMember = isMemberOnlyRole(highestRole);
  const showBillable = !isMember;

  const [tab, setTab] = useState<TaskTab>('time');
  const [task, setTask] = useState<Task | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [markDoneLoading, setMarkDoneLoading] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await api<Task>(`/tasks/${taskId}`);
      setTask(detail);

      const projectId = detail.projectId;
      const [projectsRes, teamRes] = await Promise.all([
        canEdit
          ? api<Paginated<Project>>('/projects?pageSize=100&status=active').catch(
              () => ({ data: [] as Project[] }),
            )
          : Promise.resolve({ data: [] as Project[] }),
        projectId
          ? api<ProjectMember[]>(`/projects/${projectId}/members`).catch(
              () => [] as ProjectMember[],
            )
          : Promise.resolve([] as ProjectMember[]),
      ]);

      setProjects(projectsRes.data ?? []);
      setMembers(
        (teamRes ?? [])
          .filter((m) => m.status === 'active')
          .map((m) => m.membership),
      );
    } catch (err) {
      setTask(null);
      setError(getErrorMessage(err, 'Could not load this task.'));
    } finally {
      setLoading(false);
    }
  }, [taskId, canEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'settings' && !canEdit) setTab('time');
  }, [tab, canEdit]);

  const tabs = useMemo(() => {
    const items: { id: TaskTab; label: string }[] = [
      { id: 'time', label: 'Time' },
      { id: 'overview', label: 'Overview' },
    ];
    if (canEdit) items.push({ id: 'settings', label: 'Settings' });
    return items;
  }, [canEdit]);

  async function handleSubmit(values: CreateTaskInput | UpdateTaskInput) {
    if (!task) return;
    setSubmitting(true);
    try {
      const updated = await api<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: values as UpdateTaskInput,
      });
      setTask(updated);
      toast.success('Task updated');
      setTab('overview');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update task'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkDone() {
    if (!task) return;
    setMarkDoneLoading(true);
    try {
      const updated = await api<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: { status: 'done' },
      });
      setTask(updated);
      toast.success(`Marked ${task.name} done`);
      setMarkingDone(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not mark task done'));
    } finally {
      setMarkDoneLoading(false);
    }
  }

  async function handleArchive() {
    if (!task) return;
    setArchiveLoading(true);
    try {
      await api(`/tasks/${task.id}`, { method: 'DELETE' });
      toast.success(`Archived ${task.name}`);
      setArchiving(false);
      router.push('/tasks');
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

  if (error || !task) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 pl-1"
          onClick={() => router.push('/tasks')}
        >
          <IconChevronLeft className="h-4 w-4" />
          Tasks
        </Button>
        <EmptyState
          title="Task unavailable"
          description={error ?? 'Could not load this task.'}
          actionLabel="Back to tasks"
          onAction={() => router.push('/tasks')}
        />
      </div>
    );
  }

  const clientName = task.project?.client?.name || null;
  const projectName = task.project?.name || null;
  const projectId = task.projectId;
  const assignee = personLabel(task.assignee);
  const manager = personLabel(task.project?.owner);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-1 gap-1.5 pl-1"
          onClick={() => router.push('/tasks')}
        >
          <IconChevronLeft className="h-4 w-4" />
          Tasks
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-navy">
          {task.name}
        </h1>
        {(clientName || projectName) && (
          <p className="mt-0.5 text-sm text-slate">
            {clientName ? <span>{clientName}</span> : null}
            {clientName && projectName ? ' · ' : null}
            {projectName ? (
              projectId ? (
                <Link
                  href={`/projects/${projectId}`}
                  className="font-medium text-navy underline-offset-2 hover:text-coral hover:underline"
                >
                  {projectName}
                </Link>
              ) : (
                <span>{projectName}</span>
              )
            ) : null}
          </p>
        )}
        <p className="mt-1 text-xs text-slate">
          {[
            task.status,
            assignee ? `Owner: ${assignee}` : null,
            manager ? `Manager: ${manager}` : null,
            `Est. ${formatHours(task.estimatedHours)} hrs`,
            showBillable
              ? task.billable
                ? 'Billable'
                : 'Non-billable'
              : null,
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

      {tab === 'time' ? (
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <TaskActivityPanel
            task={task}
            showBillable={showBillable}
            canStartTimer={canTrackTime}
          />
        </section>
      ) : null}

      {tab === 'overview' ? (
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate">
                Client
              </dt>
              <dd className="mt-1 text-sm text-navy">{clientName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate">
                Project
              </dt>
              <dd className="mt-1 text-sm text-navy">
                {projectId && projectName ? (
                  <Link
                    href={`/projects/${projectId}`}
                    className="underline-offset-2 hover:text-coral hover:underline"
                  >
                    {projectName}
                  </Link>
                ) : (
                  projectName || '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate">
                Status
              </dt>
              <dd className="mt-1 text-sm capitalize text-navy">{task.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate">
                Primary owner
              </dt>
              <dd className="mt-1 text-sm text-navy">{assignee || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate">
                Estimated hours
              </dt>
              <dd className="mt-1 text-sm tabular-nums text-navy">
                {formatHours(task.estimatedHours)}
              </dd>
            </div>
            {showBillable ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate">
                  Billable
                </dt>
                <dd className="mt-1 text-sm text-navy">
                  {task.billable ? 'Yes' : 'No'}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate">
                Created
              </dt>
              <dd className="mt-1 text-sm text-navy">
                {formatShortDate(task.createdAt)}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {tab === 'settings' && canEdit ? (
        <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <TaskForm
            mode="edit"
            initial={task}
            projects={
              projects.length > 0
                ? projects
                : task.project
                  ? [
                      {
                        id: task.project.id,
                        organisationId: task.organisationId,
                        clientId: task.project.clientId ?? '',
                        name: task.project.name,
                        code: task.project.code ?? null,
                        ownerId: task.project.ownerId ?? null,
                        startDate: null,
                        endDate: null,
                        status: 'active',
                        budgetHours: null,
                        budgetValue: null,
                        billableByDefault: true,
                        color: null,
                        createdAt: task.createdAt,
                        updatedAt: task.updatedAt,
                        client: task.project.client
                          ? {
                              id: task.project.client.id,
                              name: task.project.client.name,
                              currency: null,
                            }
                          : null,
                        owner: task.project.owner ?? null,
                      } satisfies Project,
                    ]
                  : []
            }
            members={members}
            submitting={submitting}
            canSetBillable={canSetBillable}
            showBillable={showBillable}
            fixedProjectId={task.projectId}
            onSubmit={handleSubmit}
            onCancel={() => setTab('overview')}
          />
          <div className="flex flex-wrap gap-2 border-t border-navy/10 pt-4">
            {task.status === 'open' ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMarkingDone(true)}
              >
                Mark done
              </Button>
            ) : null}
            {task.status !== 'archived' ? (
              <Button
                type="button"
                variant="secondary"
                className="text-danger hover:text-danger"
                onClick={() => setArchiving(true)}
              >
                Archive
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={markingDone}
        title="Mark task done?"
        description={`${task.name} will leave Open and show as Done. You can change status again from Settings if needed.`}
        confirmLabel="Mark done"
        loading={markDoneLoading}
        onConfirm={() => void handleMarkDone()}
        onCancel={() => {
          if (!markDoneLoading) setMarkingDone(false);
        }}
      />

      <ConfirmDialog
        open={archiving}
        title="Archive task?"
        description={`${task.name} will be marked archived. Filter by Archived on Tasks to find it again.`}
        confirmLabel="Archive"
        danger
        loading={archiveLoading}
        onConfirm={() => void handleArchive()}
        onCancel={() => {
          if (!archiveLoading) setArchiving(false);
        }}
      />
    </div>
  );
}
