'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import {
  isMemberAllowedPath,
  isMemberOnlyRole,
  navPermissionForPath,
} from '@/lib/app-nav';
import { usePermissions } from '@/lib/use-permissions';

/**
 * Route gates: permission check + FINAL FIX 3 member shell
 * (members: Dashboard / Time / Tasks / Projects / Tickets only).
 */
export function RoutePermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, highestRole } = usePermissions();

  const required = navPermissionForPath(pathname);
  const permissionOk = !required || can(required.resource, required.action);
  const memberOk =
    !isMemberOnlyRole(highestRole) || isMemberAllowedPath(pathname);
  const allowed = permissionOk && memberOk;

  useEffect(() => {
    if (!allowed && pathname !== '/dashboard') {
      router.replace('/dashboard');
    }
  }, [allowed, pathname, router]);

  if (!allowed) {
    return <LoadingScreen message="Redirecting…" />;
  }

  return <>{children}</>;
}
