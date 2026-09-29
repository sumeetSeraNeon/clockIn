/**
 * FIX 1 — Clockify-style permission matrix (single source of truth).
 * Seeded into `permissions` rows; runtime helpers live in `permissions.ts`.
 *
 * Scope meanings (row visibility — enforced in FIX 3):
 * - own      → assignments / own time
 * - managed  → projects.owner_id = me (PM) OR memberships.manager_id = me (team mgr)
 *              managed always includes own
 * - all      → whole organisation
 */

export const SYSTEM_ROLE_NAMES = [
  'owner',
  'admin',
  'team_manager',
  'project_manager',
  'member',
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

/** Highest → lowest for UI labels and conflict resolution. */
export const ROLE_RANK: Record<SystemRoleName, number> = {
  owner: 500,
  admin: 400,
  team_manager: 300,
  project_manager: 200,
  member: 100,
};

export type PermissionScope = 'own' | 'managed' | 'all';

export type PermissionSeedRow = {
  id: string;
  resource: string;
  action: string;
  scope: PermissionScope;
};

/** How "managed" is resolved for each resource family (docs for FIX 3). */
export const MANAGED_VIA = {
  project: 'projects.owner_id = current membership id',
  task: 'task.project.owner_id = current membership id',
  ticket: 'ticket.project.owner_id = current membership id',
  client: 'client via managed projects',
  member: 'memberships.manager_id = current membership id',
  timesheet: 'team: manager_id | projects: project.owner_id',
  billable: 'projects.owner_id = current membership id',
  report: 'union of managed projects / managed team (role-dependent)',
} as const;

/**
 * Role → permissions. IDs are stable for upserts in seed.
 * Keys must match SYSTEM_ROLE_NAMES / seed ROLE constants.
 */
export const ROLE_PERMISSION_MATRIX: Record<
  SystemRoleName,
  PermissionSeedRow[]
> = {
  member: [
    { id: '00000000-0000-4000-8000-000000000041', resource: 'time_entry', action: 'edit', scope: 'own' },
    // Assigned projects only (read-only participation — no Clients/Reports/Rates)
    { id: '00000000-0000-4000-8000-000000000042', resource: 'project', action: 'view', scope: 'own' },
    { id: '00000000-0000-4000-8000-000000000043', resource: 'task', action: 'view', scope: 'own' },
    { id: '00000000-0000-4000-8000-000000000044', resource: 'ticket', action: 'view', scope: 'own' },
  ],
  project_manager: [
    { id: '00000000-0000-4000-8000-000000000051', resource: 'time_entry', action: 'edit', scope: 'own' },
    { id: '00000000-0000-4000-8000-000000000052', resource: 'project', action: 'view', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000053', resource: 'project', action: 'edit', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000054', resource: 'task', action: 'view', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000055', resource: 'task', action: 'edit', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000056', resource: 'ticket', action: 'view', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000057', resource: 'client', action: 'view', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000058', resource: 'member', action: 'view', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000059', resource: 'timesheet', action: 'approve', scope: 'managed' },
    { id: '00000000-0000-4000-8000-00000000005a', resource: 'billable', action: 'set', scope: 'managed' },
    { id: '00000000-0000-4000-8000-00000000005b', resource: 'report', action: 'view', scope: 'managed' },
    // FINAL FIX 9 — members view-only; PM/admin/owner edit tickets
    { id: '00000000-0000-4000-8000-00000000005c', resource: 'ticket', action: 'edit', scope: 'managed' },
  ],
  team_manager: [
    { id: '00000000-0000-4000-8000-000000000061', resource: 'time_entry', action: 'edit', scope: 'own' },
    { id: '00000000-0000-4000-8000-000000000062', resource: 'project', action: 'view', scope: 'own' },
    { id: '00000000-0000-4000-8000-000000000063', resource: 'task', action: 'view', scope: 'own' },
    { id: '00000000-0000-4000-8000-000000000064', resource: 'ticket', action: 'view', scope: 'own' },
    { id: '00000000-0000-4000-8000-000000000065', resource: 'client', action: 'view', scope: 'own' },
    { id: '00000000-0000-4000-8000-000000000066', resource: 'member', action: 'view', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000067', resource: 'timesheet', action: 'approve', scope: 'managed' },
    { id: '00000000-0000-4000-8000-000000000068', resource: 'report', action: 'view', scope: 'managed' },
  ],
  admin: [
    { id: '00000000-0000-4000-8000-000000000071', resource: 'time_entry', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000072', resource: 'project', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000073', resource: 'project', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000074', resource: 'task', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000075', resource: 'task', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000076', resource: 'ticket', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000077', resource: 'client', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000078', resource: 'client', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000079', resource: 'member', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000007a', resource: 'membership', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000007b', resource: 'timesheet', action: 'approve', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000007c', resource: 'billable', action: 'set', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000007d', resource: 'rate', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000007e', resource: 'rate', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000007f', resource: 'report', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000090', resource: 'ticket', action: 'edit', scope: 'all' },
  ],
  owner: [
    { id: '00000000-0000-4000-8000-000000000081', resource: 'time_entry', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000082', resource: 'project', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000083', resource: 'project', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000084', resource: 'task', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000085', resource: 'task', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000086', resource: 'ticket', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000087', resource: 'client', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000088', resource: 'client', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000089', resource: 'member', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000008a', resource: 'membership', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000008b', resource: 'timesheet', action: 'approve', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000008c', resource: 'billable', action: 'set', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000008d', resource: 'rate', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000008e', resource: 'rate', action: 'edit', scope: 'all' },
    { id: '00000000-0000-4000-8000-00000000008f', resource: 'report', action: 'view', scope: 'all' },
    { id: '00000000-0000-4000-8000-000000000091', resource: 'ticket', action: 'edit', scope: 'all' },
  ],
};
