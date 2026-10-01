'use client';

import { useMemo, useState } from 'react';
import { EmployeeOverview } from '@/app/(app)/dashboard/EmployeeOverview';
import { ManagerOverview } from '@/app/(app)/dashboard/ManagerOverview';
import { Input } from '@/components/ui/Input';
import {
  formatWeekLabel,
  monthRange,
  parseDateParam,
  toDateParam,
  weekRange,
} from '@/lib/date-range';
import { useAuth } from '@/lib/auth-context';
import { isMemberOnlyRole } from '@/lib/app-nav';
import { usePermissions } from '@/lib/use-permissions';

type PeriodPreset = 'week' | 'month' | 'custom';

/**
 * Role-aware landing after login.
 * FIX 2 — adjustable period; owner/manager overview leads with money when commercial.
 * Members always get personal hours + their tasks (never org/revenue).
 */
export default function DashboardPage() {
  const { me } = useAuth();
  const { scopeFor, highestRole, highestRoleLabel } = usePermissions();
  const reportScope = scopeFor('report', 'view');
  const showManagerOverview =
    !isMemberOnlyRole(highestRole) &&
    (reportScope === 'all' || reportScope === 'managed');

  const [preset, setPreset] = useState<PeriodPreset>('week');
  const [customFrom, setCustomFrom] = useState(() =>
    toDateParam(weekRange().from),
  );
  const [customTo, setCustomTo] = useState(() => toDateParam(weekRange().to));

  const range = useMemo(() => {
    if (preset === 'week') return weekRange();
    if (preset === 'month') return monthRange();
    let from = parseDateParam(customFrom);
    let to = parseDateParam(customTo);
    if (from.getTime() > to.getTime()) {
      const swap = from;
      from = to;
      to = swap;
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }, [preset, customFrom, customTo]);

  const dateFrom = toDateParam(range.from);
  const dateTo = toDateParam(range.to);
  const periodLabel = formatWeekLabel(range.from, range.to);
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
          {periodLabel} · {orgName} · {roleLabel}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy">
          Hi, {firstName}
        </h1>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="flex gap-1 border-b border-navy/10">
            {(
              [
                ['week', 'This week'],
                ['month', 'This month'],
                ['custom', 'Custom range'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={
                  preset === key
                    ? 'border-b-2 border-coral px-3 py-2 text-sm font-medium text-coral'
                    : 'px-3 py-2 text-sm text-slate hover:text-navy'
                }
              >
                {label}
              </button>
            ))}
          </div>

          {preset === 'custom' ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate">
                From
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-auto"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate">
                To
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-auto"
                />
              </label>
            </div>
          ) : null}
        </div>
      </header>

      {showManagerOverview ? (
        <ManagerOverview
          periodLabel={periodLabel}
          orgName={orgName}
          dateFrom={dateFrom}
          dateTo={dateTo}
          todayParam={todayParam}
          daysElapsed={daysElapsed}
        />
      ) : (
        <EmployeeOverview
          periodLabel={periodLabel}
          dateFrom={dateFrom}
          dateTo={dateTo}
          todayParam={todayParam}
          daysElapsed={daysElapsed}
        />
      )}
    </div>
  );
}
