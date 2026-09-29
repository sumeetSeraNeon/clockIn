'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';

export type PermissionScope = 'own' | 'managed' | 'all';

const SCOPE_RANK: Record<PermissionScope, number> = {
  own: 1,
  managed: 2,
  all: 3,
};

const ROLE_RANK: Record<string, number> = {
  owner: 500,
  admin: 400,
  team_manager: 300,
  project_manager: 200,
  member: 100,
};

function asScope(value: string | null | undefined): PermissionScope {
  if (value === 'own' || value === 'managed' || value === 'all') return value;
  return 'all';
}

function formatRoleLabel(role: string | null): string {
  if (!role) return 'Member';
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * UI convenience only — backend still enforces permissions.
 * FIX 1: returns action allowance AND row scope (own / managed / all).
 */
export function usePermissions() {
  const { me } = useAuth();

  return useMemo(() => {
    const permissions = me?.permissions ?? [];
    const permissionScopes = me?.permissionScopes ?? {};

    const scopeFor = (
      resource: string,
      action: string,
    ): PermissionScope | null => {
      const fromMap = permissionScopes[`${resource}:${action}`];
      if (fromMap === 'own' || fromMap === 'managed' || fromMap === 'all') {
        return fromMap;
      }
      const hit = permissions.find(
        (p) => p.resource === resource && p.action === action,
      );
      return hit ? asScope(hit.scope) : null;
    };

    const can = (resource: string, action: string) =>
      scopeFor(resource, action) !== null;

    const canAtScope = (
      resource: string,
      action: string,
      minimum: PermissionScope,
    ) => {
      const have = scopeFor(resource, action);
      if (!have) return false;
      return SCOPE_RANK[have] >= SCOPE_RANK[minimum];
    };

    const roleNames = (me?.roles ?? []).map((r) => r.name.toLowerCase());
    const highestRole =
      me?.highestRole ??
      (['owner', 'admin', 'team_manager', 'project_manager', 'member'] as const)
        .filter((r) => roleNames.includes(r))
        .sort((a, b) => ROLE_RANK[b]! - ROLE_RANK[a]!)[0] ??
      null;

    const highestRoleLabel =
      me?.highestRoleLabel ?? formatRoleLabel(highestRole);

    return {
      can,
      canAtScope,
      scopeFor,
      permissions,
      permissionScopes,
      roleNames,
      highestRole,
      highestRoleLabel,
    };
  }, [me]);
}
