'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TaskActivityPanel } from '@/components/tasks/TaskActivityPanel';
import { TasksTable } from '@/components/tasks/TasksTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { ListSkeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft } from '@/components/ui/icons';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { isMemberOnlyRole } from '@/lib/app-nav';
import { usePermissions } from '@/lib/use-permissions';
import type { Paginated, Project, Task } from '@/types/api';

/**
 * Project detail — tasks on this project. Track opens the activity timeline.
 */
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = String(params.id ?? '');
  const { me } = useAuth();
  const { can, highestRole } = usePermissions();
  const canEditTasks = can('task', 'edit');
  const canTrackTime = can('time_entry', 'edit');
  const isMember = isMemberOnlyRole(highestRole);
  const showBillable = !isMember;
  const myMembershipId = me?.membership?.id ?? null;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityTask, setActivityTask] = useState<Task | null>(null);
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
      const tasksRes = await api<Paginated<Task>>(
        `/tasks?${taskParams.toString()}`,
      );
      setProject(projectRes);
      let list = tasksRes.data ?? [];
      if (!canEditTasks && myMembershipId) {
        list = list.filter((t) => t.assigneeId === myMembershipId);
      }
      setTasks(list);
    } catch {
      setProject(null);
      setTasks([]);
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

  const projectsById = new Map(
    project ? [[project.id, project] as const] : [],
  );
  const membersById = new Map();

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
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 gap-1.5 pl-1"
          onClick={() => router.push('/projects')}
        >
          <IconChevronLeft className="h-4 w-4" />
          Projects
        </Button>
        <PageHeader
          title={project.name}
          description={
            [
              project.code,
              manager ? `Manager: ${manager}` : null,
              statusLabel(project.status),
            ]
              .filter(Boolean)
              .join(' · ') || undefined
          }
        />
      </div>

      <section className="space-y-3 border-t border-navy/10 pt-5">
        <div>
          <h2 className="text-base font-semibold text-navy">
            {canEditTasks ? 'Tasks' : 'Your tasks'}
          </h2>
          <p className="mt-1 text-sm text-slate">
            {canEditTasks
              ? 'Open tasks on this project.'
              : 'Open tasks assigned to you on this project.'}
          </p>
        </div>
        {tasks.length === 0 ? (
          <EmptyState
            title="No open tasks"
            description={
              canEditTasks
                ? 'Create or assign tasks from the Tasks page for this project.'
                : 'No open tasks assigned to you on this project yet.'
            }
            actionLabel={canEditTasks ? 'Go to Tasks' : undefined}
            onAction={
              canEditTasks ? () => router.push('/tasks') : undefined
            }
          />
        ) : (
          <TasksTable
            tasks={tasks}
            projectsById={projectsById}
            membersById={membersById}
            canEdit={false}
            canTrackTime={canTrackTime}
            showBillable={showBillable}
            memberView={isMember}
            onTrack={(task) => setActivityTask(task)}
            onEdit={() => undefined}
            onMarkDone={() => undefined}
            onArchive={() => undefined}
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
    </div>
  );
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}
