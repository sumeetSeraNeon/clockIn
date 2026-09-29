'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLogout, IconMenu } from '@/components/ui/icons';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/use-permissions';
import { cn } from '@/lib/cn';

type AppTopBarProps = {
  orgName: string;
  onOpenNav?: () => void;
};

export function AppTopBar({ orgName, onOpenNav }: AppTopBarProps) {
  const { me, logout } = useAuth();
  const { highestRoleLabel } = usePermissions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = me?.user.name || me?.user.email || 'User';
  const email = me?.user.email ?? '';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function handleLogout() {
    setOpen(false);
    void logout().then(() => router.replace('/login'));
  }

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between gap-3 border-b border-navy/15 bg-card px-4 sm:gap-4 sm:px-7">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-navy" />

      <div className="flex min-w-0 items-center gap-2">
        {onOpenNav ? (
          <button
            type="button"
            onClick={onOpenNav}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate transition hover:bg-navy/[0.06] hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral md:hidden"
            aria-label="Open navigation"
            aria-controls="mobile-nav"
          >
            <IconMenu className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-navy">
            {orgName}
          </p>
          <p className="truncate text-xs text-slate">
            {highestRoleLabel ? `${highestRoleLabel} access` : 'Workspace'}
          </p>
        </div>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-md py-1 pl-1 pr-2 text-left transition',
            'hover:bg-navy/[0.04]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral',
          )}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Account menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[160px] truncate text-sm font-medium text-navy">
              {displayName}
            </span>
          </span>
          <span
            className={cn(
              'hidden text-navy/50 transition sm:inline',
              open && 'rotate-180',
            )}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-md border border-navy/15 bg-card py-2 shadow-sm"
          >
            <div className="border-b border-navy/10 px-4 pb-3 pt-1">
              <p className="truncate text-sm font-medium text-navy">
                {displayName}
              </p>
              {email ? (
                <p className="mt-0.5 truncate text-xs text-slate">{email}</p>
              ) : null}
            </div>
            <button
              type="button"
              role="menuitem"
              className="mt-1 flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-navy transition hover:bg-navy/[0.04]"
              onClick={handleLogout}
            >
              <IconLogout className="h-4 w-4 text-slate" />
              Log out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
