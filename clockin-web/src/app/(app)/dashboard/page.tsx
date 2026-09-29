'use client';

import { useMemo } from 'react';
import { EmployeeOverview } from '@/app/(app)/dashboard/EmployeeOverview';
import { ManagerOverview } from '@/app/(app)/dashboard/ManagerOverview';
import { formatWeekLabel, toDateParam, weekRange } from '@/lib/date-range';
import { useAuth } from '@/lib/auth-context';
import { isMemberOnlyRole } from '@/lib/app-nav';
import { usePermissions } from '@/lib/use-permissions';

/**
 * Role-aware landing after login.
 * FINAL FIX 4 — members always get personal hours + their tasks (never org/revenue).
 * Managers/admins with report:view (managed/all) get the org summary.
 */
export default function DashboardPage() {
  const { me } = useAuth();
  const { scopeFor, highestRole, highestRoleLabel } = usePermissions();
  const reportScope = scopeFor('report', 'view');
  const showManagerOverview =
    !isMemberOnlyRole(highestRole) &&
    (reportScope === 'all' || reportScope === 'managed');

  const range = useMemo(() => weekRange(), []);
  const dateFrom = toDateParam(range.from);
  const dateTo = toDateParam(range.to);
  const weekLabel = formatWeekLabel(range.from, range.to);
  const todayParam = toDateParam(new Date());

  const daysElapsed = useMemo(() => {
    const start = range.from.getTime();
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const end = Math.min(now.getTime(), range.to.getTime());
    return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
  }, [range.from, range.to]);

  const firstName =
    me?.user.name?.split(/\s+/)[0] ||
    me?.user.email?.split('@')[0] ||
    'there';

  const orgName = me?.organisation?.name ?? 'your organisation';
  const roleLabel = highestRoleLabel ?? 'Member';

  return (
    <div className="mx-auto max-w-6xl">
      <header className="border-b border-navy/10 pb-5">
        <p className="text-sm text-slate">
          {weekLabel} · {orgName} · {roleLabel}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy">
          Hi, {firstName}
        </h1>
      </header>

      {showManagerOverview ? (
        <ManagerOverview
          weekLabel={weekLabel}
          orgName={orgName}
          dateFrom={dateFrom}
          dateTo={dateTo}
          todayParam={todayParam}
          daysElapsed={daysElapsed}
        />
      ) : (
        <EmployeeOverview
          weekLabel={weekLabel}
          dateFrom={dateFrom}
          dateTo={dateTo}
          todayParam={todayParam}
          daysElapsed={daysElapsed}
        />
      )}
    </div>
  );
}
