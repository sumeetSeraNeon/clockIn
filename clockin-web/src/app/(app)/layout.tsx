'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { AppSidebar } from '@/components/common/AppSidebar';
import { AppTopBar } from '@/components/common/AppTopBar';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { RoutePermissionGuard } from '@/components/common/RoutePermissionGuard';
import { useAuth } from '@/lib/auth-context';

const COLLAPSE_KEY = 'clockin.sidebar.collapsed';

export default function AppShellLayout({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  if (status === 'loading') {
    return <LoadingScreen message="Checking your session…" />;
  }

  if (status === 'unauthenticated') {
    return <LoadingScreen message="Redirecting to sign in…" />;
  }

  const orgName = me?.organisation?.name || 'Organisation';

  return (
    <div className="flex h-full overflow-hidden overscroll-none bg-paper">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg focus:ring-2 focus:ring-coral"
      >
        Skip to main content
      </a>
      <AppSidebar
        orgName={orgName}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar
          orgName={orgName}
          onOpenNav={() => setMobileOpen(true)}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="app-scroll min-h-0 flex-1 px-4 pb-8 pt-2 outline-none sm:px-7 sm:pb-10"
        >
          <AppErrorBoundary>
            <RoutePermissionGuard>{children}</RoutePermissionGuard>
          </AppErrorBoundary>
        </main>
      </div>
    </div>
  );
}
