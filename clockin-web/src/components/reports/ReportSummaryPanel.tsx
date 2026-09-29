'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Stat } from '@/app/(app)/dashboard/Stat';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { ReportSummaryResponse } from '@/types/api';

const COLORS = [
  '#ff494a',
  '#14142b',
  '#1d9e75',
  '#ba7517',
  '#5f5e5a',
  '#c0392b',
];

type ReportSummaryPanelProps = {
  report: ReportSummaryResponse;
};

function formatRevenue(amount: string | null, currency: string | null) {
  const cur = currency && currency !== 'USD' ? currency : currency || 'GBP';
  if (!amount || amount === '0.00') return `0.00 ${cur}`;
  return `${amount} ${cur}`;
}

export function ReportSummaryPanel({ report }: ReportSummaryPanelProps) {
  const { totals, groups, groupBy, reconcile } = report;
  const commercial = report.commercial !== false && totals.revenue != null;
  const billableShare =
    totals.durationMinutes > 0
      ? Math.round((totals.billableMinutes / totals.durationMinutes) * 100)
      : 0;
  const unratedMinutes = commercial ? (totals.unratedBillableMinutes ?? 0) : 0;
  const pendingMinutes = totals.pendingDurationMinutes ?? 0;

  const mixData = useMemo(() => {
    const rows = [
      {
        name: 'Billable',
        value: totals.billableMinutes,
        fill: '#ff494a',
      },
      {
        name: 'Non-billable',
        value: totals.nonBillableMinutes,
        fill: '#14142b',
      },
    ].filter((r) => r.value > 0);
    return rows;
  }, [totals.billableMinutes, totals.nonBillableMinutes]);

  const groupChartData = useMemo(
    () =>
      [...groups]
        .sort((a, b) => b.durationMinutes - a.durationMinutes)
        .slice(0, 12)
        .map((g) => ({
          name: (g.label || 'Unassigned').slice(0, 22),
          hours: Number((g.durationMinutes / 60).toFixed(2)),
          billableHours: Number((g.billableMinutes / 60).toFixed(2)),
          revenue: g.revenue != null ? Number(g.revenue) : 0,
        })),
    [groups],
  );

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-border/80 bg-paper px-4 py-3 text-sm text-slate">
        {commercial ? (
          <>
            Showing{' '}
            <span className="font-medium text-ink">approved time only</span>.
            Draft, submitted, and rejected hours are excluded from revenue until
            approved.
          </>
        ) : (
          <>
            Team performance uses{' '}
            <span className="font-medium text-ink">approved hours</span> only.
            Revenue is hidden for managers — ask an admin for commercial
            reports.
          </>
        )}
      </p>

      <div
        className={`grid gap-6 rounded-lg border border-border/80 bg-card px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-7 ${
          commercial ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}
      >
        <Stat
          label="Approved hours"
          value={formatHoursMinutes(totals.durationMinutes)}
          hint="Counted in this report"
        />
        <Stat
          label="Billable"
          value={formatHoursMinutes(totals.billableMinutes)}
          hint={`${billableShare}% of approved`}
          accent
        />
        <Stat
          label="Non-billable"
          value={formatHoursMinutes(totals.nonBillableMinutes)}
        />
        {commercial ? (
          <Stat
            label="Revenue"
            value={formatRevenue(totals.revenue, totals.currency)}
            hint="Approved billable × rate"
          />
        ) : null}
      </div>

      {pendingMinutes > 0 ? (
        <p className="rounded-lg border border-border/80 bg-paper px-4 py-3 text-sm text-ink">
          <span className="font-medium">
            {formatHoursMinutes(pendingMinutes)} pending
          </span>
          {totals.pendingBillableMinutes
            ? ` (${formatHoursMinutes(totals.pendingBillableMinutes)} billable)`
            : ''}{' '}
          not yet approved
          {commercial ? ' — excluded from revenue until approved.' : '.'}
        </p>
      ) : null}

      {unratedMinutes > 0 ? (
        <p className="rounded-lg border border-coral/25 bg-coral-tint/50 px-4 py-3 text-sm text-ink">
          {formatHoursMinutes(unratedMinutes)} of approved billable time has no
          matching billable rate on the entry date — revenue for those lines is
          0 until a rate is added.
        </p>
      ) : null}

      {commercial && reconcile && !reconcile.matchesTotals ? (
        <p className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          Group revenue ({reconcile.groupsRevenue}) does not match totals (
          {totals.revenue}). Check rate lookup.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border/80 bg-card px-5 py-5">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Billable mix
          </h2>
          <p className="mt-1 text-sm text-slate">Approved hours only</p>
          {mixData.length === 0 ? (
            <p className="mt-8 text-sm text-slate">No approved time in range.</p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mixData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {mixData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      formatHoursMinutes(Number(value))
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border/80 bg-card px-5 py-5">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Hours by {groupBy}
          </h2>
          <p className="mt-1 text-sm text-slate">
            Top groups in range
            {reconcile
              ? ` · ${reconcile.lineCount} line${reconcile.lineCount === 1 ? '' : 's'}`
              : ''}
          </p>
          {groupChartData.length === 0 ? (
            <p className="mt-8 text-sm text-slate">
              No approved time lines in this range.
            </p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupChartData}
                  layout="vertical"
                  margin={{ left: 8, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="hours" name="Hours" fill="#ff494a" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {groups.length > 0 ? (
        <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Breakdown
          </h2>
          <ul className="mt-4 divide-y divide-navy/10">
            {groups.map((group, index) => {
              const share =
                totals.durationMinutes > 0
                  ? Math.round(
                      (group.durationMinutes / totals.durationMinutes) * 100,
                    )
                  : 0;
              return (
                <li
                  key={group.key}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                    <span className="truncate font-medium text-ink">
                      {group.label || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-baseline gap-3 tabular-nums">
                    <span className="text-xs text-slate">
                      {formatHoursMinutes(group.billableMinutes)} billable
                    </span>
                    {commercial && group.revenue ? (
                      <span className="text-xs text-slate">
                        {formatRevenue(group.revenue, group.currency)}
                      </span>
                    ) : null}
                    <span className="text-xs text-slate">{share}%</span>
                    <span className="font-medium text-ink">
                      {formatHoursMinutes(group.durationMinutes)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
