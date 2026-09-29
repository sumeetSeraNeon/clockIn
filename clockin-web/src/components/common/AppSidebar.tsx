'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/common/BrandMark';
import { APP_NAV, MEMBER_NAV_HREFS, isMemberOnlyRole } from '@/lib/app-nav';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/lib/use-permissions';
import {
  IconChevronLeft,
  IconChevronRight,
} from '@/components/ui/icons';

type AppSidebarProps = {
  orgName: string;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

function SidebarChrome({
  orgName,
  collapsed,
  onToggle,
  onNavClick,
  showDesktopCollapse,
  showMobileClose,
  onMobileClose,
}: {
  orgName: string;
  collapsed: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
  showDesktopCollapse: boolean;
  showMobileClose?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const { can, highestRole } = usePermissions();

  const visibleNav = APP_NAV.filter((item) => {
    if (isMemberOnlyRole(highestRole)) {
      return MEMBER_NAV_HREFS.has(item.href);
    }
    return (
      !item.permission ||
      can(item.permission.resource, item.permission.action)
    );
  });

  return (
    <>
      <div
        className={cn(
          'flex h-[76px] items-center px-3',
          collapsed ? 'justify-center gap-1' : 'justify-between gap-2 px-4',
        )}
      >
        {collapsed ? (
          <>
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl"
              title="ClockIn"
              aria-label="ClockIn home"
              onClick={onNavClick}
            >
              <BrandMark size={36} className="rounded-xl" />
            </Link>
            {showDesktopCollapse ? (
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex h-9 w-9 items-center justify-center text-slate transition-colors hover:text-coral"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <IconChevronRight className="h-5 w-5" />
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/dashboard"
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                title="ClockIn"
                aria-label="ClockIn home"
                onClick={onNavClick}
              >
                <BrandMark size={40} className="rounded-xl" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-ink">
                  ClockIn
                </p>
                <p className="truncate text-xs text-slate" title={orgName}>
                  {orgName}
                </p>
              </div>
            </div>
            {showDesktopCollapse ? (
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-slate transition-colors hover:text-coral"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <IconChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            {showMobileClose ? (
              <button
                type="button"
                onClick={onMobileClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-slate transition-colors hover:text-coral"
                aria-label="Close navigation"
              >
                <IconChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pb-6" aria-label="Main">
        {visibleNav.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? 'page' : undefined}
              onClick={onNavClick}
              className={cn(
                'group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors',
                active
                  ? 'bg-coral-tint text-coral'
                  : 'text-slate hover:text-ink',
                collapsed && 'justify-center px-2',
              )}
            >
              {active ? (
                <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-coral" />
              ) : null}
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  active ? 'text-coral' : 'text-slate group-hover:text-ink',
                )}
              />
              {!collapsed ? <span className="truncate">{label}</span> : null}
              {collapsed ? <span className="sr-only">{label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function AppSidebar({
  orgName,
  collapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: AppSidebarProps) {
  return (
    <>
      <aside
        className={cn(
          'relative hidden h-full shrink-0 flex-col overflow-y-auto overscroll-none bg-card transition-[width] duration-200 md:flex',
          collapsed ? 'w-[80px]' : 'w-72',
          '[&::-webkit-scrollbar]:w-0 [scrollbar-width:none]',
        )}
      >
        <SidebarChrome
          orgName={orgName}
          collapsed={collapsed}
          onToggle={onToggle}
          showDesktopCollapse
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border/70" />
      </aside>

      <div
        className={cn(
          'fixed inset-0 z-50 md:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <button
          type="button"
          className={cn(
            'absolute inset-0 bg-ink/40 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          aria-label="Close navigation overlay"
          onClick={onMobileClose}
          tabIndex={mobileOpen ? 0 : -1}
        />
        <aside
          id="mobile-nav"
          className={cn(
            'absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col overflow-y-auto overscroll-none bg-card shadow-[8px_0_30px_rgba(26,26,26,0.12)] transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-hidden={!mobileOpen}
        >
          <SidebarChrome
            orgName={orgName}
            collapsed={false}
            onToggle={onToggle}
            onNavClick={onMobileClose}
            showDesktopCollapse={false}
            showMobileClose
            onMobileClose={onMobileClose}
          />
        </aside>
      </div>
    </>
  );
}
