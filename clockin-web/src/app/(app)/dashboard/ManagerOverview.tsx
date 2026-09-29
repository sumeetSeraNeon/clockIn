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
import { usePermissions } from '@/lib/use-permissions';
import type {
  ReportSummaryGroup,
  ReportSummaryResponse,
} from '@/types/api';

const COLORS = [
  '#ff494a',
  '#14142b',
  '#1d9e75',
  '#ba7517',
  '#5f5e5a',
  '#c0392b',
];

function BreakdownList({
  title,
  subtitle,
  groups,
  totalMinutes,
  emptyLabel,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  groups: ReportSummaryGroup[];
  totalMinutes: number;
  emptyLabel: string;
  href?: string;
  linkLabel?: string;
}) {
  const maxMinutes = Math.max(...groups.map((g) => g.durationMinutes), 1);

  return (
    <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-navy">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate">{subtitle}</p>
        </div>
        {href && linkLabel ? (
          <Link
            href={href}
            className="text-sm font-medium text-slate transition hover:text-coral"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-slate">{emptyLabel}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {groups.slice(0, 8).map((group, index) => {
            const width = Math.max(
              6,
              Math.round((group.durationMinutes / maxMinutes) * 100),
            );
            const color = COLORS[index % COLORS.length];
            const share =
              totalMinutes > 0
                ? Math.round((group.durationMinutes / totalMinutes) * 100)
                : 0;
            return (
              <li key={group.key}>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate font-medium text-ink">
                      {group.label || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3 tabular-nums">
                    <span className="text-xs text-slate">{share}%</span>
                    <span className="font-medium text-ink">
                      {formatHoursMinutes(group.durationMinutes)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: color }}
                  />
                </div>
                <div className="mt-1.5 flex gap-3 text-[11px] text-slate">
                  <span>
                    Billable {formatHoursMinutes(group.billableMinutes)}
                  </span>
                  <span>
                    Non-billable {formatHoursMinutes(group.nonBillableMinutes)}
                  </span>
                  {group.revenue && group.revenue !== '0.00' ? (
                    <span>
                      {group.currency ? `${group.currency} ` : ''}
                      {group.revenue}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type DashboardData = {
  byProject: ReportSummaryResponse;
  byClient: ReportSummaryResponse;
  byUser: ReportSummaryResponse;
  today: ReportSummaryResponse;
};

type ManagerOverviewProps = {
  weekLabel: string;
  orgName: string;
  dateFrom: string;
  dateTo: string;
  todayParam: string;
  daysElapsed: number;
};

/** Org-wide week analysis for roles with report:view. */
export function ManagerOverview({
  weekLabel,
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
        const weekBase = { dateFrom, dateTo };
        const [byProject, byClient, byUser, today] = await Promise.all([
          api<ReportSummaryResponse>(
            `/reports/summary?${new URLSearchParams({
              ...weekBase,
              groupBy: 'project',
            })}`,
          ),
          api<ReportSummaryResponse>(
            `/reports/summary?${new URLSearchParams({
              ...weekBase,
              groupBy: 'client',
            })}`,
          ),
          api<ReportSummaryResponse>(
            `/reports/summary?${new URLSearchParams({
              ...weekBase,
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
              : 'Could not load this week’s summary.',
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
  const hasTime = (totals?.durationMinutes ?? 0) > 0;
  const billableShare =
    totals && totals.durationMinutes > 0
      ? Math.round((totals.billableMinutes / totals.durationMinutes) * 100)
      : 0;
  const nonBillableShare = hasTime ? 100 - billableShare : 0;
  const avgPerDayMinutes = totals
    ? Math.round(totals.durationMinutes / daysElapsed)
    : 0;

  const amountLabel =
    totals?.currency && totals.revenue
      ? `${totals.currency} ${totals.revenue}`
      : totals?.revenue && totals.revenue !== '0.00'
        ? totals.revenue
        : '—';

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
      <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-navy">
              Management
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-navy">
              Organisation week
            </h2>
          </div>
          <p className="text-sm text-slate">{orgName}</p>
        </div>

        <div className="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="This week"
            value={formatHoursMinutes(totals?.durationMinutes ?? 0)}
            accent
          />
          <Stat
            label="Today"
            value={formatHoursMinutes(todayTotals?.durationMinutes ?? 0)}
          />
          <Stat
            label="Billable"
            value={formatHoursMinutes(totals?.billableMinutes ?? 0)}
            hint={hasTime ? `${billableShare}% of week` : undefined}
          />
          <Stat
            label="Non-billable"
            value={formatHoursMinutes(totals?.nonBillableMinutes ?? 0)}
          />
          <Stat
            label="Daily average"
            value={formatHoursMinutes(avgPerDayMinutes)}
            hint={`${daysElapsed} day${daysElapsed === 1 ? '' : 's'} so far`}
          />
          {data?.byProject.commercial !== false &&
          data?.byProject.totals?.revenue != null ? (
            <Stat label="Amount" value={amountLabel} />
          ) : null}
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
              Nothing tracked this week
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate">
              Breakdowns appear once the team logs time for {weekLabel}.
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

      {hasTime ? (
        <>
          <div className="grid gap-6 border border-border/80 bg-card px-5 py-4 sm:grid-cols-3 sm:px-6">
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

          <div className="grid gap-5 lg:grid-cols-2">
            <BreakdownList
              title="Projects"
              subtitle="Hours by project this week"
              groups={data?.byProject.groups ?? []}
              totalMinutes={totals?.durationMinutes ?? 0}
              emptyLabel="No project time this week."
              href="/projects"
              linkLabel="Projects →"
            />
            <BreakdownList
              title="Clients"
              subtitle="Hours by client this week"
              groups={data?.byClient.groups ?? []}
              totalMinutes={totals?.durationMinutes ?? 0}
              emptyLabel="No client time this week."
              href="/clients"
              linkLabel="Clients →"
            />
          </div>

          <BreakdownList
            title="Team"
            subtitle="Who tracked time this week"
            groups={data?.byUser.groups ?? []}
            totalMinutes={totals?.durationMinutes ?? 0}
            emptyLabel="No team time this week."
            href="/team"
            linkLabel="Team →"
          />
        </>
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
