import {
  ROLE_RANK,
  SYSTEM_ROLE_NAMES,
  type PermissionScope,
  type SystemRoleName,
} from './permission-matrix';

export type { PermissionScope, SystemRoleName };
export { ROLE_RANK, SYSTEM_ROLE_NAMES, MANAGED_VIA } from './permission-matrix';

export type PermissionGrant = {
  resource: string;
  action: string;
  /** Normalised scope; null treated as all at merge time. */
  scope: PermissionScope | null;
};

const SCOPE_RANK: Record<PermissionScope, number> = {
  own: 1,
  managed: 2,
  all: 3,
};

function asScope(value: string | null | undefined): PermissionScope {
  if (value === 'own' || value === 'managed' || value === 'all') return value;
  return 'all';
}

function permKey(resource: string, action: string): string {
  return `${resource}:${action}`;
}

/**
 * Merge grants from all roles: same resource:action keeps the widest scope.
 * `managed` includes `own` for visibility (FIX 3 will filter rows accordingly).
 */
export function mergePermissionGrants(
  grants: PermissionGrant[],
): PermissionGrant[] {
  const byKey = new Map<string, PermissionGrant>();
  for (const g of grants) {
    const scope = asScope(g.scope);
    const key = permKey(g.resource, g.action);
    const existing = byKey.get(key);
    if (!existing || SCOPE_RANK[scope] > SCOPE_RANK[asScope(existing.scope)]) {
      byKey.set(key, {
        resource: g.resource,
        action: g.action,
        scope,
      });
    }
  }
  return Array.from(byKey.values());
}

/** True if the membership may perform resource:action at any scope. */
export function can(
  grants: PermissionGrant[],
  resource: string,
  action: string,
): boolean {
  return scopeFor(grants, resource, action) !== null;
}

/**
 * Widest scope for resource:action, or null if not allowed.
 * This is the FIX 1 contract: not only "can?" but "over which rows?"
 */
export function scopeFor(
  grants: PermissionGrant[],
  resource: string,
  action: string,
): PermissionScope | null {
  const merged = mergePermissionGrants(grants);
  const hit = merged.find(
    (g) => g.resource === resource && g.action === action,
  );
  return hit ? asScope(hit.scope) : null;
}

/** Does `have` cover rows that need `need`? (all > managed > own) */
export function scopeCovers(
  have: PermissionScope | null,
  need: PermissionScope,
): boolean {
  if (!have) return false;
  return SCOPE_RANK[have] >= SCOPE_RANK[need];
}

/**
 * True if the grant allows acting at least at `minimumScope`.
 * Example: need managed project edit → all or managed pass; own fails.
 */
export function canAtScope(
  grants: PermissionGrant[],
  resource: string,
  action: string,
  minimumScope: PermissionScope,
): boolean {
  return scopeCovers(scopeFor(grants, resource, action), minimumScope);
}

/** owner > admin > team_manager > project_manager > member */
export function highestRoleName(
  roleNames: string[],
): SystemRoleName | null {
  const normalised = roleNames.map((n) => n.trim().toLowerCase());
  let best: SystemRoleName | null = null;
  let bestRank = -1;
  for (const name of SYSTEM_ROLE_NAMES) {
    if (normalised.includes(name) && ROLE_RANK[name] > bestRank) {
      best = name;
      bestRank = ROLE_RANK[name];
    }
  }
  return best;
}

/** Human label for top bar / dashboard. */
export function formatRoleLabel(role: string | null): string {
  if (!role) return 'Member';
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
