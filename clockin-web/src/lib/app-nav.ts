import type { ComponentType } from 'react';
import {
  IconApprovals,
  IconCalendar,
  IconClients,
  IconDashboard,
  IconProjects,
  IconRates,
  IconReports,
  IconTasks,
  IconTeam,
  IconTickets,
  IconTime,
} from '@/components/ui/icons';

type IconProps = { className?: string };

export type NavPermission = {
  resource: string;
  action: string;
};

/**
 * FIX 2 — single nav + route permission map.
 * `permission: null` = any authenticated member may open it.
 */
export type AppNavItem = {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
  permission: NavPermission | null;
};

export const APP_NAV: AppNavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    Icon: IconDashboard,
    permission: null,
  },
  {
    href: '/time',
    label: 'Timesheet',
    Icon: IconTime,
    permission: { resource: 'time_entry', action: 'edit' },
  },
  {
    href: '/calendar',
    label: 'Calendar',
    Icon: IconCalendar,
    permission: { resource: 'time_entry', action: 'edit' },
  },
  {
    href: '/approvals',
    label: 'Approvals',
    Icon: IconApprovals,
    permission: { resource: 'timesheet', action: 'approve' },
  },
  {
    href: '/clients',
    label: 'Clients',
    Icon: IconClients,
    permission: { resource: 'client', action: 'view' },
  },
  {
    href: '/projects',
    label: 'Projects',
    Icon: IconProjects,
    permission: { resource: 'project', action: 'view' },
  },
  {
    href: '/tasks',
    label: 'Tasks',
    Icon: IconTasks,
    permission: { resource: 'task', action: 'view' },
  },
  {
    href: '/tickets',
    label: 'Tickets',
    Icon: IconTickets,
    permission: { resource: 'ticket', action: 'view' },
  },
  {
    href: '/team',
    label: 'Team',
    Icon: IconTeam,
    permission: { resource: 'member', action: 'view' },
  },
  {
    href: '/rates',
    label: 'Rates',
    Icon: IconRates,
    permission: { resource: 'rate', action: 'view' },
  },
  {
    href: '/reports',
    label: 'Reports',
    Icon: IconReports,
    permission: { resource: 'report', action: 'view' },
  },
];

/**
 * FINAL FIX 3 — member shell: work context without commercial screens.
 * Projects = read-only assigned projects. No Clients / Reports / Rates /
 * Approvals / Team.
 */
export const MEMBER_NAV_HREFS = new Set([
  '/dashboard',
  '/time',
  '/calendar',
  '/tasks',
  '/projects',
  '/tickets',
]);

export function isMemberOnlyRole(highestRole: string | null | undefined): boolean {
  return highestRole === 'member';
}

/** Whether a path is allowed in the member experience (FIX 3). */
export function isMemberAllowedPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/dashboard') return true;
  return [...MEMBER_NAV_HREFS].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

/** Match pathname to a nav rule (longest href first for nested routes). */
export function navPermissionForPath(pathname: string): NavPermission | null {
  const match = [...APP_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
  return match?.permission ?? null;
}
