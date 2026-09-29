import {
  can,
  canAtScope,
  highestRoleName,
  mergePermissionGrants,
  scopeCovers,
  scopeFor,
  type PermissionGrant,
} from './permissions';
import { ROLE_PERMISSION_MATRIX } from './permission-matrix';

function grantsFor(role: keyof typeof ROLE_PERMISSION_MATRIX): PermissionGrant[] {
  return ROLE_PERMISSION_MATRIX[role].map((p) => ({
    resource: p.resource,
    action: p.action,
    scope: p.scope,
  }));
}

describe('FIX 1 permission resolution', () => {
  it('merges to widest scope for the same resource:action', () => {
    const merged = mergePermissionGrants([
      { resource: 'project', action: 'view', scope: 'own' },
      { resource: 'project', action: 'view', scope: 'managed' },
    ]);
    expect(merged).toEqual([
      { resource: 'project', action: 'view', scope: 'managed' },
    ]);
  });

  it('member: own time/tasks/tickets + assigned project view; no clients/reports/rates', () => {
    const g = grantsFor('member');
    expect(can(g, 'time_entry', 'edit')).toBe(true);
    expect(scopeFor(g, 'time_entry', 'edit')).toBe('own');
    expect(can(g, 'task', 'view')).toBe(true);
    expect(can(g, 'ticket', 'view')).toBe(true);
    expect(can(g, 'ticket', 'edit')).toBe(false);
    expect(scopeFor(g, 'project', 'view')).toBe('own');
    expect(can(g, 'project', 'edit')).toBe(false);
    expect(can(g, 'client', 'view')).toBe(false);
    expect(can(g, 'report', 'view')).toBe(false);
    expect(can(g, 'client', 'edit')).toBe(false);
    expect(can(g, 'rate', 'view')).toBe(false);
    expect(can(g, 'membership', 'edit')).toBe(false);
  });

  it('project_manager: managed project edit; no rate; timesheet approve managed', () => {
    const g = grantsFor('project_manager');
    expect(scopeFor(g, 'project', 'edit')).toBe('managed');
    expect(scopeFor(g, 'project', 'view')).toBe('managed');
    expect(canAtScope(g, 'project', 'edit', 'managed')).toBe(true);
    expect(canAtScope(g, 'project', 'edit', 'all')).toBe(false);
    expect(scopeFor(g, 'timesheet', 'approve')).toBe('managed');
    expect(can(g, 'rate', 'view')).toBe(false);
    expect(can(g, 'billable', 'set')).toBe(true);
    expect(scopeFor(g, 'ticket', 'edit')).toBe('managed');
  });

  it('team_manager: managed member view + timesheet approve; no project edit', () => {
    const g = grantsFor('team_manager');
    expect(scopeFor(g, 'member', 'view')).toBe('managed');
    expect(scopeFor(g, 'timesheet', 'approve')).toBe('managed');
    expect(can(g, 'project', 'edit')).toBe(false);
    expect(scopeFor(g, 'project', 'view')).toBe('own');
  });

  it('admin and owner: all scopes on org resources including rates', () => {
    for (const role of ['admin', 'owner'] as const) {
      const g = grantsFor(role);
      expect(scopeFor(g, 'project', 'view')).toBe('all');
      expect(scopeFor(g, 'client', 'edit')).toBe('all');
      expect(scopeFor(g, 'rate', 'view')).toBe('all');
      expect(scopeFor(g, 'membership', 'edit')).toBe('all');
      expect(scopeFor(g, 'report', 'view')).toBe('all');
    }
  });

  /** FINAL FIX 8 — manager side must keep commercial + approval features */
  it('owner/admin/PM keep billable, reports, approvals, team (rates = admin/owner)', () => {
    for (const role of ['owner', 'admin'] as const) {
      const g = grantsFor(role);
      expect(can(g, 'billable', 'set')).toBe(true);
      expect(can(g, 'report', 'view')).toBe(true);
      expect(can(g, 'timesheet', 'approve')).toBe(true);
      expect(can(g, 'member', 'view')).toBe(true);
      expect(can(g, 'rate', 'view')).toBe(true);
      expect(can(g, 'rate', 'edit')).toBe(true);
      expect(can(g, 'project', 'edit')).toBe(true);
      expect(can(g, 'task', 'edit')).toBe(true);
      expect(can(g, 'client', 'view')).toBe(true);
      expect(can(g, 'ticket', 'edit')).toBe(true);
    }

    const pm = grantsFor('project_manager');
    expect(can(pm, 'billable', 'set')).toBe(true);
    expect(can(pm, 'report', 'view')).toBe(true);
    expect(can(pm, 'timesheet', 'approve')).toBe(true);
    expect(can(pm, 'member', 'view')).toBe(true);
    expect(can(pm, 'project', 'edit')).toBe(true);
    expect(can(pm, 'task', 'edit')).toBe(true);
    expect(can(pm, 'client', 'view')).toBe(true);
    expect(can(pm, 'ticket', 'edit')).toBe(true);
    // Rates stay admin/owner-only (golden rule)
    expect(can(pm, 'rate', 'view')).toBe(false);
  });

  it('scopeCovers: all covers managed covers own', () => {
    expect(scopeCovers('all', 'own')).toBe(true);
    expect(scopeCovers('managed', 'own')).toBe(true);
    expect(scopeCovers('own', 'managed')).toBe(false);
    expect(scopeCovers(null, 'own')).toBe(false);
  });

  it('highestRoleName order: owner > admin > team_manager > project_manager > member', () => {
    expect(highestRoleName(['member', 'project_manager'])).toBe(
      'project_manager',
    );
    expect(highestRoleName(['team_manager', 'admin'])).toBe('admin');
    expect(highestRoleName(['member', 'owner', 'admin'])).toBe('owner');
    expect(highestRoleName(['project_manager', 'team_manager'])).toBe(
      'team_manager',
    );
    expect(highestRoleName(['employee'])).toBeNull();
  });
});
