import type { Project, Task } from '@/types/api';

/** Hard daily logging cap (Timesheet UX harden). */
export const DAILY_CAP_MINUTES = 8 * 60;

/** Display label: Client · Project when client is known. */
export function projectOptionLabel(project: {
  name: string;
  client?: { name: string } | null;
}): string {
  const clientName = project.client?.name?.trim();
  if (clientName) return `${clientName} · ${project.name}`;
  return project.name;
}

export type ClientPickerOption = {
  id: string;
  name: string;
};

export type ProjectPickerOption = {
  id: string;
  name: string;
  label: string;
};

/** Distinct clients from projects (sorted by name). */
export function clientsFromProjects(
  projects: Project[],
): ClientPickerOption[] {
  const byId = new Map<string, ClientPickerOption>();
  for (const p of projects) {
    const id = p.client?.id ?? p.clientId;
    if (!id) continue;
    const name = p.client?.name?.trim() || 'Client';
    if (!byId.has(id)) byId.set(id, { id, name });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Projects for a client — name only (client already selected). */
export function projectsForClient(
  projects: Project[],
  clientId: string,
): ProjectPickerOption[] {
  if (!clientId) return [];
  return projects
    .filter((p) => (p.client?.id ?? p.clientId) === clientId)
    .map((p) => ({ id: p.id, name: p.name, label: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function clientIdForProject(
  projects: Project[],
  projectId: string,
): string {
  if (!projectId) return '';
  const p = projects.find((x) => x.id === projectId);
  return p?.client?.id ?? p?.clientId ?? '';
}

/** Distinct projects that have at least one task in the list (stable label order). */
export function projectsFromTasks(
  tasks: Task[],
  projectsLookup: Project[] = [],
): ProjectPickerOption[] {
  const byId = new Map<string, ProjectPickerOption>();

  for (const p of projectsLookup) {
    byId.set(p.id, {
      id: p.id,
      name: p.name,
      label: projectOptionLabel(p),
    });
  }

  for (const t of tasks) {
    if (!t.projectId) continue;
    const lookup = projectsLookup.find((p) => p.id === t.projectId);
    const name = t.project?.name || lookup?.name || 'Project';
    const clientName = lookup?.client?.name ?? null;
    const label = clientName ? `${clientName} · ${name}` : name;
    const existing = byId.get(t.projectId);
    if (!existing || t.project?.name || lookup?.client) {
      byId.set(t.projectId, { id: t.projectId, name, label });
    }
  }

  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Projects the member can log against (intersection of lookup + task project ids),
 * used to build Client → Project cascade options.
 */
export function projectsScopedToTasks(
  tasks: Task[],
  projectsLookup: Project[] = [],
): Project[] {
  const ids = new Set(tasks.map((t) => t.projectId).filter(Boolean));
  const byId = new Map<string, Project>();
  for (const p of projectsLookup) {
    if (ids.has(p.id)) byId.set(p.id, p);
  }
  for (const t of tasks) {
    if (!t.projectId || byId.has(t.projectId)) continue;
    const lookup = projectsLookup.find((p) => p.id === t.projectId);
    byId.set(t.projectId, {
      id: t.projectId,
      organisationId: '',
      clientId: lookup?.clientId ?? lookup?.client?.id ?? '',
      name: t.project?.name || lookup?.name || 'Project',
      code: lookup?.code ?? null,
      ownerId: lookup?.ownerId ?? null,
      startDate: lookup?.startDate ?? null,
      endDate: lookup?.endDate ?? null,
      status: lookup?.status ?? 'active',
      budgetHours: lookup?.budgetHours ?? null,
      budgetValue: lookup?.budgetValue ?? null,
      billableByDefault: lookup?.billableByDefault ?? true,
      color: lookup?.color ?? null,
      createdAt: lookup?.createdAt ?? '',
      updatedAt: lookup?.updatedAt ?? '',
      client: lookup?.client ?? null,
    });
  }
  return [...byId.values()];
}

export function tasksForProject(tasks: Task[], projectId: string): Task[] {
  if (!projectId) return [];
  return tasks.filter((t) => t.projectId === projectId);
}

export function projectIdForTask(tasks: Task[], taskId: string): string {
  if (!taskId) return '';
  return tasks.find((t) => t.id === taskId)?.projectId ?? '';
}

/** Sum of line minutes for entries on a given local date (YYYY-MM-DD). */
export function dayLoggedMinutes(
  entries: {
    id: string;
    entryDate: string;
    timeLines?: { durationMinutes?: number | null }[] | null;
  }[],
  date: string,
  excludeEntryId?: string,
): number {
  const day = date.slice(0, 10);
  return entries.reduce((sum, entry) => {
    if (entry.entryDate.slice(0, 10) !== day) return sum;
    if (excludeEntryId && entry.id === excludeEntryId) return sum;
    const lines = entry.timeLines ?? [];
    return (
      sum + lines.reduce((s, line) => s + (line.durationMinutes ?? 0), 0)
    );
  }, 0);
}
