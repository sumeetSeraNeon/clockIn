'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { ProjectTeamPanel } from '@/components/projects/ProjectTeamPanel';
import { TaskActivityPanel } from '@/components/tasks/TaskActivityPanel';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TasksTable } from '@/components/tasks/TasksTable';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft } from '@/components/ui/icons';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { isMemberOnlyRole } from '@/lib/app-nav';
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

/**
 * Project detail — team + tasks. Edit in place when task:edit; Track opens activity.
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
  const canTrackTime = can('time_entry', 'edit');
  const canSetBillable = can('billable', 'set');
  const canViewRates = can('rate', 'view');
  const canEditRates = can('rate', 'edit');
  const isMember = isMemberOnlyRole(highestRole);
  const showBillable = !isMember;
  const myMembershipId = me?.membership?.id ?? null;
  const orgCurrency = me?.organisation?.currency ?? 'GBP';

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<MemberSummary[]>([]);
  const [activityTask, setActivityTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [archiving, setArchiving] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (!canEditTasks && myMembershipId) {
        taskParams.set('assigneeId', myMembershipId);
      }
      const [tasksRes, teamRes] = await Promise.all([
        api<Paginated<Task>>(`/tasks?${taskParams.toString()}`),
        api<ProjectMember[]>(`/projects/${projectId}/members`).catch(
          () => [] as ProjectMember[],
        ),
      ]);
      setProject(projectRes);
      let list = tasksRes.data ?? [];
      if (!canEditTasks && myMembershipId) {
        list = list.filter((t) => t.assigneeId === myMembershipId);
      }
      setTasks(list);
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
  }, [projectId, canEditTasks, myMembershipId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function handleCreate(values: CreateTaskInput | UpdateTaskInput) {
    setSubmitting(true);
    try {
      await api<Task>('/tasks', {
        method: 'POST',
        body: values as CreateTaskInput,
      });
      toast.success('Task created');
      setCreating(false);
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

  async function handleMarkDone(task: Task) {
    try {
      await api<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: { status: 'done' } satisfies UpdateTaskInput,
      });
      toast.success(`Marked ${task.name} done`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not mark task done'));
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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-navy">
            {project.name}
          </h1>
          <p className="text-sm text-slate">
            {[
              project.code,
              manager ? `Manager: ${manager}` : null,
              statusLabel(project.status),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <ProjectTeamPanel
        projectId={project.id}
        projectOwnerId={project.ownerId}
        projectName={project.name}
        canEdit={canEditProject}
        canViewOrgMembers={canViewMembers}
        canViewRates={canViewRates}
        canEditRates={canEditRates}
        orgCurrency={orgCurrency}
        onTeamChange={() => void load()}
      />

      <section className="space-y-3 border-t border-navy/10 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">
              {canEditTasks ? 'Tasks' : 'Your tasks'}
            </h2>
            <p className="mt-0.5 text-sm text-slate">
              {canEditTasks
                ? 'Open tasks on this project. Assignees must be on the project Team.'
                : 'Open tasks assigned to you on this project.'}
            </p>
          </div>
          {canEditTasks ? (
            <Button type="button" onClick={() => setCreating(true)}>
              Add task
            </Button>
          ) : null}
        </div>
        {tasks.length === 0 ? (
          <EmptyState
            title="No open tasks"
            description={
              canEditTasks
                ? 'Add a task on this project to get started.'
                : 'No open tasks assigned to you on this project yet.'
            }
            actionLabel={canEditTasks ? 'Add task' : undefined}
            onAction={
              canEditTasks ? () => setCreating(true) : undefined
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
            onMarkDone={(t) => void handleMarkDone(t)}
            onArchive={setArchiving}
          />
        )}
      </section>

      <TaskActivityPanel
        task={activityTask}
        open={Boolean(activityTask)}
        onClose={() => setActivityTask(null)}
        showBillable={showBillable}
        canStartTimer={
          Boolean(
            canTrackTime &&
              activityTask &&
              myMembershipId &&
              activityTask.assigneeId === myMembershipId,
          )
        }
      />

      <Modal
        open={creating}
        title="Add task"
        description={`Create a task on ${project.name}. Assignee must be on the project team.`}
        onClose={() => {
          if (!submitting) setCreating(false);
        }}
      >
        <TaskForm
          mode="create"
          projects={projectList}
          members={teamMembers}
          fixedProjectId={project.id}
          submitting={submitting}
          canSetBillable={canSetBillable}
          showBillable={showBillable}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
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

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}
