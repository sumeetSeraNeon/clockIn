'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  IconClients,
  IconProjects,
  IconReports,
  IconTeam,
  IconTime,
} from '@/components/ui/icons';
import { Skeleton } from '@/components/common/Skeleton';
import { Stat } from '@/app/(app)/dashboard/Stat';
import { api, ApiError } from '@/lib/api-client';
import { formatHoursMinutes } from '@/lib/format-duration';
import { formatMoney } from '@/lib/format-money';
import { usePermissions } from '@/lib/use-permissions';
import type {
  ReportSummaryGroup,
  ReportSummaryResponse,
} from '@/types/api';

type DashboardData = {
  byProject: ReportSummaryResponse;
  byClient: ReportSummaryResponse;
  byUser: ReportSummaryResponse;
  today: ReportSummaryResponse;
};

type ManagerOverviewProps = {
  periodLabel: string;
  orgName: string;
  dateFrom: string;
  dateTo: string;
  todayParam: string;
  daysElapsed: number;
};

function ProfitabilityList({
  title,
  groups,
  emptyLabel,
  href,
  linkLabel,
}: {
  title: string;
  groups: ReportSummaryGroup[];
  emptyLabel: string;
  href: string;
  linkLabel: string;
}) {
  const rows = [...groups]
    .sort((a, b) => Number(b.margin ?? 0) - Number(a.margin ?? 0))
    .slice(0, 8);

  return (
    <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-navy">
          {title}
        </h2>
        <Link
          href={href}
          className="text-sm font-medium text-slate transition hover:text-coral"
        >
          {linkLabel}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-slate">{emptyLabel}</p>
      ) : (
        <ul className="mt-5 divide-y divide-navy/10">
          {rows.map((group) => {
            const pct =
              group.marginPercent != null
                ? Number(group.marginPercent)
                : null;
            return (
              <li
                key={group.key}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm"
              >
                <span className="min-w-0 truncate font-medium text-ink">
                  {group.label || 'Unassigned'}
                </span>
                <div className="flex shrink-0 flex-wrap items-baseline gap-3 tabular-nums">
                  <span className="text-slate">
                    {formatMoney(group.revenue, group.currency)}
                  </span>
                  <span className="text-slate">
                    − {formatMoney(group.cost ?? null, group.currency)}
                  </span>
                  <span className="font-medium text-navy">
                    {formatMoney(group.margin ?? null, group.currency)}
                    {pct != null ? (
                      <span className="ml-1 font-normal text-slate">
                        ({pct.toFixed(0)}%)
                      </span>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Org summary for roles with report:view. FIX 2 — money first when commercial. */
export function ManagerOverview({
  periodLabel,
  orgName,
  dateFrom,
  dateTo,
  todayParam,
  daysElapsed,
}: ManagerOverviewProps) {
  const { can } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const periodBase = { dateFrom, dateTo };
        const [byProject, byClient, byUser, today] = await Promise.all([
          api<ReportSummaryResponse>(
            `/reports/summary?${new URLSearchParams({
              ...periodBase,
              groupBy: 'project',
            })}`,
          ),
          api<ReportSummaryResponse>(
            `/reports/summary?${new URLSearchParams({
              ...periodBase,
              groupBy: 'client',
            })}`,
          ),
          api<ReportSummaryResponse>(
            `/reports/summary?${new URLSearchParams({
              ...periodBase,
              groupBy: 'user',
            })}`,
          ),
          api<ReportSummaryResponse>(
            `/reports/summary?${new URLSearchParams({
              dateFrom: todayParam,
              dateTo: todayParam,
              groupBy: 'project',
            })}`,
          ),
        ]);
        if (!cancelled) setData({ byProject, byClient, byUser, today });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Could not load this period’s summary.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, todayParam]);

  const totals = data?.byProject.totals;
  const todayTotals = data?.today.totals;
  const commercial = data?.byProject.commercial === true;
  const hasTime = (totals?.durationMinutes ?? 0) > 0;
  const billableShare =
    totals && totals.durationMinutes > 0
      ? Math.round((totals.billableMinutes / totals.durationMinutes) * 100)
      : 0;
  const nonBillableShare = hasTime ? 100 - billableShare : 0;
  const avgPerDayMinutes = totals
    ? Math.round(totals.durationMinutes / daysElapsed)
    : 0;
  const marginPct =
    totals?.marginPercent != null ? Number(totals.marginPercent) : null;

  if (loading) {
    return (
      <div className="mt-10 space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-44 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <section className="mt-10 rounded-lg border border-border/80 bg-card px-5 py-6">
        <p className="text-sm font-medium text-danger">{error}</p>
        <p className="mt-1 text-sm text-slate">
          Make sure the API is running, then refresh.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-10 space-y-5">
      {/* 1. Hero — money leads when commercial */}
      <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-navy">
              {orgName}
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-navy">
              {periodLabel}
            </h2>
          </div>
          <p className="text-sm text-slate">Approved time</p>
        </div>

        {commercial ? (
          <div className="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Revenue"
              value={formatMoney(totals?.revenue ?? null, totals?.currency ?? null)}
            />
            <Stat
              label="Cost"
              value={formatMoney(totals?.cost ?? null, totals?.currency ?? null)}
            />
            <Stat
              label="Margin"
              value={formatMoney(totals?.margin ?? null, totals?.currency ?? null)}
              accent
            />
            <Stat
              label="Margin %"
              value={marginPct != null ? `${marginPct.toFixed(0)}%` : '—'}
            />
          </div>
        ) : (
          <div className="mt-7 grid gap-8 sm:grid-cols-3">
            <Stat
              label="Hours"
              value={formatHoursMinutes(totals?.durationMinutes ?? 0)}
              accent
            />
            <Stat
              label="Billable"
              value={formatHoursMinutes(totals?.billableMinutes ?? 0)}
              hint={hasTime ? `${billableShare}%` : undefined}
            />
            <Stat
              label="Today"
              value={formatHoursMinutes(todayTotals?.durationMinutes ?? 0)}
            />
          </div>
        )}

        {commercial ? (
          <p className="mt-5 text-sm text-slate">
            {formatHoursMinutes(totals?.durationMinutes ?? 0)} approved ·{' '}
            {formatHoursMinutes(todayTotals?.durationMinutes ?? 0)} today · avg{' '}
            {formatHoursMinutes(avgPerDayMinutes)}/day
          </p>
        ) : null}
      </section>

      {/* 2. Hours + billable mix */}
      <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-7">
        <h2 className="text-base font-semibold tracking-tight text-navy">
          Hours this period
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          <Stat
            label="Total"
            value={formatHoursMinutes(totals?.durationMinutes ?? 0)}
          />
          <Stat
            label="Billable"
            value={formatHoursMinutes(totals?.billableMinutes ?? 0)}
            hint={hasTime ? `${billableShare}%` : undefined}
          />
          <Stat
            label="Non-billable"
            value={formatHoursMinutes(totals?.nonBillableMinutes ?? 0)}
            hint={hasTime ? `${nonBillableShare}%` : undefined}
          />
        </div>

        {hasTime ? (
          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-ink">Billable mix</span>
              <span className="tabular-nums text-slate">
                {billableShare}% / {nonBillableShare}%
              </span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-paper">
              <div
                className="h-full bg-coral"
                style={{ width: `${billableShare}%` }}
              />
              <div
                className="h-full bg-navy/80"
                style={{ width: `${nonBillableShare}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center border-t border-border/70 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-coral-tint text-coral">
              <IconTime className="h-5 w-5" />
            </div>
            <p className="mt-4 text-base font-semibold tracking-tight text-navy">
              Nothing tracked this period
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate">
              Breakdowns appear once the team logs approved time for{' '}
              {periodLabel}.
            </p>
            <Link
              href="/time"
              className="mt-5 inline-flex text-sm font-medium text-coral transition hover:text-coral-dark"
            >
              Open time tracker →
            </Link>
          </div>
        )}
      </section>

      {/* 3. Profitability by project / client (commercial only) */}
      {commercial && hasTime ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ProfitabilityList
            title="Profitability by project"
            groups={data?.byProject.groups ?? []}
            emptyLabel="No project profitability this period."
            href="/reports"
            linkLabel="Reports →"
          />
          <ProfitabilityList
            title="Profitability by client"
            groups={data?.byClient.groups ?? []}
            emptyLabel="No client profitability this period."
            href="/reports"
            linkLabel="Reports →"
          />
        </div>
      ) : null}

      {/* Non-commercial: hours by project/client (no money) */}
      {!commercial && hasTime ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <HoursBreakdown
            title="By project"
            groups={data?.byProject.groups ?? []}
            totalMinutes={totals?.durationMinutes ?? 0}
            emptyLabel="No project time this period."
            href="/projects"
            linkLabel="Projects →"
          />
          <HoursBreakdown
            title="By client"
            groups={data?.byClient.groups ?? []}
            totalMinutes={totals?.durationMinutes ?? 0}
            emptyLabel="No client time this period."
            href="/clients"
            linkLabel="Clients →"
          />
        </div>
      ) : null}

      {/* 4. Supporting stats */}
      {hasTime ? (
        <div className="grid gap-6 rounded-lg border border-border/80 bg-card px-5 py-4 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-[13px] text-slate">Active projects</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">
              {data?.byProject.groups.length ?? 0}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-slate">Active clients</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">
              {data?.byClient.groups.length ?? 0}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-slate">People tracking</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">
              {data?.byUser.groups.length ?? 0}
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border border-border/80 bg-card px-5 py-4 sm:px-6">
        <p className="text-sm font-medium text-ink">Quick links</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/time', label: 'Time tracker', Icon: IconTime },
            {
              href: '/clients',
              label: 'Clients',
              Icon: IconClients,
              show: can('client', 'edit'),
            },
            {
              href: '/projects',
              label: 'Projects',
              Icon: IconProjects,
              show: can('project', 'edit'),
            },
            {
              href: '/team',
              label: 'Team',
              Icon: IconTeam,
              show: can('membership', 'edit'),
            },
            {
              href: '/reports',
              label: 'Full reports',
              Icon: IconReports,
              show: true,
            },
          ]
            .filter((item) => item.show !== false)
            .slice(0, 4)
            .map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate transition hover:bg-paper hover:text-ink"
              >
                <Icon className="h-[18px] w-[18px] text-coral" />
                {label}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}

function HoursBreakdown({
  title,
  groups,
  totalMinutes,
  emptyLabel,
  href,
  linkLabel,
}: {
  title: string;
  groups: ReportSummaryGroup[];
  totalMinutes: number;
  emptyLabel: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-navy">
          {title}
        </h2>
        <Link
          href={href}
          className="text-sm font-medium text-slate transition hover:text-coral"
        >
          {linkLabel}
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-slate">{emptyLabel}</p>
      ) : (
        <ul className="mt-5 divide-y divide-navy/10">
          {groups.slice(0, 8).map((group) => {
            const share =
              totalMinutes > 0
                ? Math.round((group.durationMinutes / totalMinutes) * 100)
                : 0;
            return (
              <li
                key={group.key}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="truncate font-medium text-ink">
                  {group.label || 'Unassigned'}
                </span>
                <div className="flex shrink-0 items-baseline gap-3 tabular-nums">
                  <span className="text-xs text-slate">{share}%</span>
                  <span className="font-medium text-ink">
                    {formatHoursMinutes(group.durationMinutes)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
