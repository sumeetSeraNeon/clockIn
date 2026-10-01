import type { Project, Task } from '@/types/api';

/** Distinct projects that have at least one task in the list (stable name order). */
export function projectsFromTasks(
  tasks: Task[],
  projectsLookup: Project[] = [],
): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const p of projectsLookup) {
    byId.set(p.id, p.name);
  }
  for (const t of tasks) {
    if (!t.projectId) continue;
    const name = t.project?.name || byId.get(t.projectId) || 'Project';
    if (!byId.has(t.projectId) || t.project?.name) {
      byId.set(t.projectId, name);
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function tasksForProject(tasks: Task[], projectId: string): Task[] {
  if (!projectId) return [];
  return tasks.filter((t) => t.projectId === projectId);
}

export function projectIdForTask(
  tasks: Task[],
  taskId: string,
): string {
  if (!taskId) return '';
  return tasks.find((t) => t.id === taskId)?.projectId ?? '';
}
