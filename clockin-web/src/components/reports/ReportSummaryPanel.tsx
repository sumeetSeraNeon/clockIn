'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { Stat } from '@/app/(app)/dashboard/Stat';
import { InfoTip } from '@/components/common/InfoTip';
import { Select } from '@/components/ui/Select';
import { formatHoursMinutes } from '@/lib/format-duration';
import { formatMoney } from '@/lib/format-money';
import { CHART_COLORS, nivoTheme } from '@/lib/nivo-theme';
import type {
  Member,
  ReportSummaryGroup,
  ReportSummaryResponse,
  UtilisationPersonRow,
} from '@/types/api';

type PerformanceMetric =
  | 'approved'
  | 'billable'
  | 'utilisation'
  | 'profitability';

type ReportSummaryPanelProps = {
  report: ReportSummaryResponse;
  /** Fixed groupBy=project for billable table */
  projectGroups?: ReportSummaryGroup[];
  /** Fixed groupBy=task for billable table */
  taskGroups?: ReportSummaryGroup[];
  /** Fixed groupBy=user for top people */
  userGroups?: ReportSummaryGroup[];
  /** Fixed groupBy=department for top depts */
  departmentGroups?: ReportSummaryGroup[];
  /** Fixed groupBy=client for client profitability */
  clientGroups?: ReportSummaryGroup[];
  /** Person utilisation for metric=utilisation */
  utilisationPeople?: UtilisationPersonRow[];
  /** Members with departments — for department util averages */
  members?: Member[];
};

type RankRow = { key: string; label: string; value: number; display: string };

function topByMinutes(
  groups: ReportSummaryGroup[],
  field: 'durationMinutes' | 'billableMinutes',
  limit = 10,
): RankRow[] {
  return [...groups]
    .filter((g) => (g[field] ?? 0) > 0)
    .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
    .slice(0, limit)
    .map((g) => ({
      key: g.key,
      label: g.label || 'Unassigned',
      value: g[field] ?? 0,
      display: formatHoursMinutes(g[field] ?? 0),
    }));
}

function marginNumber(g: ReportSummaryGroup): number | null {
  if (g.margin == null || g.margin === '') return null;
  const n = Number(g.margin);
  return Number.isFinite(n) ? n : null;
}

function topByMargin(
  groups: ReportSummaryGroup[],
  limit = 10,
): RankRow[] {
  return [...groups]
    .map((g) => {
      const value = marginNumber(g);
      if (value == null) return null;
      const pct =
        g.marginPercent != null && Number.isFinite(Number(g.marginPercent))
          ? ` (${Number(g.marginPercent).toFixed(0)}%)`
          : '';
      return {
        key: g.key,
        label: g.label || 'Unassigned',
        value,
        display: `${formatMoney(g.margin, g.currency)}${pct}`,
      };
    })
    .filter((r): r is RankRow => r != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function billablePct(billable: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((billable / total) * 100);
}

function metricHint(metric: PerformanceMetric): string {
  switch (metric) {
    case 'approved':
      return 'Ranked by approved hours in this range.';
    case 'billable':
      return 'Ranked by approved billable hours in this range.';
    case 'utilisation':
      return 'Ranked by utilisation % for the To date’s month.';
    case 'profitability':
      return 'Ranked by margin (revenue − cost) on approved time.';
    default:
      return '';
  }
}

function RankList({ rows }: { rows: RankRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate">No data for this metric.</p>;
  }
  return (
    <ol className="mt-3 divide-y divide-border/50">
      {rows.map((row, i) => {
        const isFirst = i === 0;
        return (
          <li
            key={row.key}
            className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted/50"
          >
            <span
              className={
                isFirst
                  ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coral/15 text-xs font-semibold tabular-nums text-coral'
                  : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-slate'
              }
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{row.label}</span>
            <span
              className={
                isFirst
                  ? 'shrink-0 font-semibold tabular-nums text-coral'
                  : 'shrink-0 font-medium tabular-nums text-navy'
              }
            >
              {row.display}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ReportSummaryPanel({
  report,
  projectGroups = [],
  taskGroups = [],
  userGroups = [],
  departmentGroups = [],
  clientGroups = [],
  utilisationPeople = [],
  members = [],
}: ReportSummaryPanelProps) {
  const [metric, setMetric] = useState<PerformanceMetric>('approved');
  const { totals, groups, groupBy, reconcile } = report;
  const commercial = report.commercial === true;
  const showProfitability =
    commercial && (groupBy === 'project' || groupBy === 'client');
  const billableShare =
    totals.durationMinutes > 0
      ? Math.round((totals.billableMinutes / totals.durationMinutes) * 100)
      : 0;
  const unratedMinutes = commercial ? (totals.unratedBillableMinutes ?? 0) : 0;
  const uncostedMinutes = commercial ? (totals.uncostedMinutes ?? 0) : 0;
  const pendingMinutes = totals.pendingDurationMinutes ?? 0;

  useEffect(() => {
    if (!commercial && metric === 'profitability') {
      setMetric('approved');
    }
  }, [commercial, metric]);

  const mixData = useMemo(() => {
    return [
      {
        id: 'Billable',
        label: 'Billable',
        value: totals.billableMinutes,
        color: CHART_COLORS.coral,
      },
      {
        id: 'Non-billable',
        label: 'Non-billable',
        value: totals.nonBillableMinutes,
        color: CHART_COLORS.navy,
      },
    ].filter((r) => r.value > 0);
  }, [totals.billableMinutes, totals.nonBillableMinutes]);

  const groupChartData = useMemo(
    () =>
      [...groups]
        .sort((a, b) => b.durationMinutes - a.durationMinutes)
        .slice(0, 12)
        .map((g) => ({
          name: (g.label || 'Unassigned').slice(0, 22),
          Billable: Number((g.billableMinutes / 60).toFixed(2)),
          'Non-billable': Number((g.nonBillableMinutes / 60).toFixed(2)),
        })),
    [groups],
  );

  const utilByUserId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of utilisationPeople) {
      if (p.utilisationPct != null) map.set(p.userId, p.utilisationPct);
    }
    return map;
  }, [utilisationPeople]);

  const topPeople = useMemo((): RankRow[] => {
    if (metric === 'utilisation') {
      return [...utilisationPeople]
        .filter(
          (p) => p.utilisationPct != null && Number.isFinite(p.utilisationPct),
        )
        .sort((a, b) => (b.utilisationPct ?? 0) - (a.utilisationPct ?? 0))
        .slice(0, 10)
        .map((p) => ({
          key: p.userId,
          label: p.userName || p.userEmail,
          value: p.utilisationPct ?? 0,
          display: `${(p.utilisationPct ?? 0).toFixed(0)}%`,
        }));
    }
    if (metric === 'profitability') {
      return topByMargin(userGroups);
    }
    return topByMinutes(
      userGroups,
      metric === 'billable' ? 'billableMinutes' : 'durationMinutes',
    );
  }, [metric, utilisationPeople, userGroups]);

  const topDepartments = useMemo((): RankRow[] => {
    if (metric === 'utilisation') {
      const buckets = new Map<
        string,
        { label: string; sum: number; count: number }
      >();
      for (const m of members) {
        const pct = utilByUserId.get(m.userId);
        if (pct == null || !Number.isFinite(pct)) continue;
        const depts =
          m.departments && m.departments.length > 0
            ? m.departments
            : m.department
              ? [{ id: `legacy-${m.department}`, name: m.department }]
              : [];
        for (const d of depts) {
          const cur = buckets.get(d.id) ?? {
            label: d.name,
            sum: 0,
            count: 0,
          };
          cur.sum += pct;
          cur.count += 1;
          buckets.set(d.id, cur);
        }
      }
      return [...buckets.entries()]
        .map(([key, b]) => {
          const avg = b.count > 0 ? b.sum / b.count : 0;
          return {
            key,
            label: b.label,
            value: avg,
            display: `${avg.toFixed(0)}%`,
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }
    if (metric === 'profitability') {
      return topByMargin(departmentGroups);
    }
    return topByMinutes(
      departmentGroups,
      metric === 'billable' ? 'billableMinutes' : 'durationMinutes',
    );
  }, [metric, members, utilByUserId, departmentGroups]);

  const profitabilityRows = useMemo(
    () =>
      [...groups].sort((a, b) => b.durationMinutes - a.durationMinutes),
    [groups],
  );

  const projectBillableRows = useMemo(
    () =>
      [...projectGroups]
        .filter((g) => g.durationMinutes > 0)
        .sort((a, b) => b.durationMinutes - a.durationMinutes),
    [projectGroups],
  );

  const taskBillableRows = useMemo(
    () =>
      [...taskGroups]
        .filter((g) => g.durationMinutes > 0)
        .sort((a, b) => b.durationMinutes - a.durationMinutes),
    [taskGroups],
  );

  const clientProfitRows = useMemo(() => {
    if (!commercial) return [];
    return [...clientGroups]
      .filter((g) => g.durationMinutes > 0 || marginNumber(g) != null)
      .sort((a, b) => {
        const ma = marginNumber(a) ?? Number.NEGATIVE_INFINITY;
        const mb = marginNumber(b) ?? Number.NEGATIVE_INFINITY;
        if (mb !== ma) return mb - ma;
        return b.durationMinutes - a.durationMinutes;
      });
  }, [clientGroups, commercial]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <p className="text-sm text-slate">
          {commercial
            ? 'Summary of approved time and money for the selected range.'
            : 'Summary of approved hours for the selected range.'}
        </p>
        <InfoTip title="How this summary works" align="end">
          {commercial ? (
            <>
              <p>
                Only <strong className="font-medium text-ink">approved</strong>{' '}
                time counts. Draft, submitted, and rejected lines are excluded.
              </p>
              <p>
                Revenue = approved billable × bill rate. Cost = approved hours ×
                cost rate. Margin = revenue − cost.
              </p>
            </>
          ) : (
            <p>
              Team performance uses{' '}
              <strong className="font-medium text-ink">approved hours</strong>{' '}
              only. Revenue, cost, and margin need rate access — ask an
              admin/owner.
            </p>
          )}
        </InfoTip>
      </div>

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
            value={formatMoney(totals.revenue, totals.currency)}
            hint="Approved billable × bill rate"
          />
        ) : null}
      </div>

      {commercial ? (
        <div className="grid gap-6 rounded-lg border border-border/80 bg-card px-5 py-5 sm:grid-cols-3 sm:px-7 sm:py-7">
          <Stat
            label="Cost"
            value={formatMoney(totals.cost ?? null, totals.currency)}
            hint="Approved hours × cost rate"
          />
          <Stat
            label="Margin"
            value={formatMoney(totals.margin ?? null, totals.currency)}
            hint="Revenue − cost"
            accent
          />
          <Stat
            label="Margin %"
            value={
              totals.marginPercent != null
                ? `${Number(totals.marginPercent).toFixed(0)}%`
                : '—'
            }
            hint="(Revenue − cost) ÷ revenue"
          />
        </div>
      ) : null}

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

      {uncostedMinutes > 0 ? (
        <p className="rounded-lg border border-border/80 bg-paper px-4 py-3 text-sm text-ink">
          {formatHoursMinutes(uncostedMinutes)} of approved time has no matching
          cost rate — cost for those lines is 0 until a cost rate is added.
        </p>
      ) : null}

      {commercial && reconcile && !reconcile.matchesTotals ? (
        <p className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          Group totals do not match org totals — revenue{' '}
          {reconcile.groupsRevenue} vs {totals.revenue}, cost{' '}
          {reconcile.groupsCost} vs {totals.cost ?? '0.00'}. Check rate lookup.
        </p>
      ) : null}

      {profitabilityRows.length > 0 ? (
        <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              {showProfitability ? 'Profitability' : 'Breakdown'}
            </h2>
            <p className="mt-1 text-sm text-slate">
              By {groupBy} for this range
              {showProfitability
                ? ' — hours plus revenue, cost, and margin.'
                : ' — approved hours split.'}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] table-fixed text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-slate">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">Hours</th>
                  <th className="px-3 py-2 text-right font-medium">Billable</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Non-billable
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Share</th>
                  {commercial ? (
                    <>
                      <th className="px-3 py-2 text-right font-medium">
                        Revenue
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Margin
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Margin %
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {profitabilityRows.map((group) => {
                  const share =
                    totals.durationMinutes > 0
                      ? Math.round(
                          (group.durationMinutes / totals.durationMinutes) *
                            100,
                        )
                      : 0;
                  return (
                    <tr key={group.key}>
                      <td className="px-3 py-2 text-left font-medium text-ink">
                        {group.label || 'Unassigned'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {formatHoursMinutes(group.durationMinutes)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-coral">
                        {formatHoursMinutes(group.billableMinutes)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-navy">
                        {formatHoursMinutes(group.nonBillableMinutes)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate">
                        {share}%
                      </td>
                      {commercial ? (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums text-slate">
                            {formatMoney(group.revenue, group.currency)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate">
                            {formatMoney(group.cost ?? null, group.currency)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-navy">
                            {formatMoney(group.margin ?? null, group.currency)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate">
                            {group.marginPercent != null
                              ? `${Number(group.marginPercent).toFixed(0)}%`
                              : '—'}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Top performance
            </h2>
            <p className="mt-1 text-sm text-slate">
              Ranked departments and people for the selected metric (top 10).
            </p>
          </div>
          <label className="flex flex-col gap-1 text-xs text-slate">
            Metric
            <Select
              className="min-w-[200px]"
              value={metric}
              onChange={(e) =>
                setMetric(e.target.value as PerformanceMetric)
              }
            >
              <option value="approved">Approved hours</option>
              <option value="billable">Billable hours</option>
              <option value="utilisation">Utilisation %</option>
              {commercial ? (
                <option value="profitability">Profitability (margin)</option>
              ) : null}
            </Select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate">{metricHint(metric)}</p>
        <div className="mt-5 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">
              Departments
            </h3>
            <RankList rows={topDepartments} />
          </div>
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">
              People
            </h3>
            <RankList rows={topPeople} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border/80 bg-card px-5 py-5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Billable mix
            </h2>
            <InfoTip title="Billable mix">
              <p>
                Share of approved hours marked billable vs non-billable in this
                range.
              </p>
            </InfoTip>
          </div>
          {mixData.length === 0 ? (
            <p className="mt-8 text-sm text-slate">No approved time in range.</p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsivePie
                data={mixData}
                theme={nivoTheme}
                colors={{ datum: 'data.color' }}
                margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                innerRadius={0.55}
                padAngle={2}
                cornerRadius={3}
                enableArcLinkLabels={false}
                arcLabelsSkipAngle={16}
                arcLabelsTextColor="#ffffff"
                valueFormat={(v) => formatHoursMinutes(Number(v))}
                tooltip={({ datum }) => (
                  <div className="min-w-[10rem] rounded-lg border border-border bg-white px-3 py-2.5 text-sm shadow-[0_4px_16px_rgba(20,20,43,0.12)]">
                    <div className="flex items-center gap-2 font-medium text-navy">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: String(datum.color) }}
                      />
                      {datum.label}
                    </div>
                    <p className="mt-1.5 tabular-nums text-slate">
                      {formatHoursMinutes(Number(datum.value))}
                    </p>
                  </div>
                )}
              />
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border/80 bg-card px-5 py-5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Hours by {groupBy}
            </h2>
            <InfoTip title={`Hours by ${groupBy}`}>
              <p>
                Top groups by approved hours (billable + non-billable stacked)
                {reconcile
                  ? ` · ${reconcile.lineCount} line${reconcile.lineCount === 1 ? '' : 's'}`
                  : ''}
                .
              </p>
              {groupBy === 'department' ? (
                <p>
                  People in multiple departments appear in each department row.
                  Org approved totals still count each time line once, so
                  department rows can sum above the org total.
                </p>
              ) : null}
            </InfoTip>
          </div>
          {groupChartData.length === 0 ? (
            <p className="mt-8 text-sm text-slate">
              No approved time lines in this range.
            </p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveBar
                data={groupChartData}
                theme={nivoTheme}
                keys={['Billable', 'Non-billable']}
                indexBy="name"
                layout="horizontal"
                groupMode="stacked"
                margin={{ top: 4, right: 16, bottom: 40, left: 100 }}
                padding={0.28}
                colors={[CHART_COLORS.coral, CHART_COLORS.navy]}
                borderRadius={2}
                enableLabel={false}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 6,
                }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 8,
                }}
                legends={[
                  {
                    dataFrom: 'keys',
                    anchor: 'bottom',
                    direction: 'row',
                    translateY: 36,
                    itemWidth: 100,
                    itemHeight: 14,
                    symbolSize: 10,
                    symbolShape: 'square',
                  },
                ]}
                tooltip={({ id, indexValue, data }) => {
                  const billable = Number(data.Billable ?? 0);
                  const nonBillable = Number(data['Non-billable'] ?? 0);
                  const total = billable + nonBillable;
                  const active = String(id);
                  return (
                    <div className="min-w-[12.5rem] rounded-lg border border-border bg-white px-3 py-2.5 text-sm shadow-[0_4px_16px_rgba(20,20,43,0.12)]">
                      <div className="font-semibold text-navy">{indexValue}</div>
                      <dl className="mt-2 space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-6">
                          <dt
                            className={
                              active === 'Billable'
                                ? 'font-medium text-coral'
                                : 'text-slate'
                            }
                          >
                            Billable
                          </dt>
                          <dd
                            className={
                              active === 'Billable'
                                ? 'font-medium tabular-nums text-coral'
                                : 'tabular-nums text-ink'
                            }
                          >
                            {billable.toFixed(2)}h
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-6">
                          <dt
                            className={
                              active === 'Non-billable'
                                ? 'font-medium text-navy'
                                : 'text-slate'
                            }
                          >
                            Non-billable
                          </dt>
                          <dd
                            className={
                              active === 'Non-billable'
                                ? 'font-medium tabular-nums text-navy'
                                : 'tabular-nums text-ink'
                            }
                          >
                            {nonBillable.toFixed(2)}h
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-6 border-t border-border/60 pt-1.5">
                          <dt className="font-medium text-slate">Total</dt>
                          <dd className="font-semibold tabular-nums text-ink">
                            {total.toFixed(2)}h
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                }}
              />
            </div>
          )}
        </section>
      </div>

      {(projectBillableRows.length > 0 || taskBillableRows.length > 0) && (
        <section className="space-y-4 rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Billable
            </h2>
            <p className="mt-1 text-sm text-slate">
              Approved billable vs non-billable by project and task.
            </p>
          </div>
          {projectBillableRows.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate">
                By project
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[32rem] table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-slate">
                      <th className="px-3 py-2 text-left font-medium">
                        Project
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Billable
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Non-billable
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Billable %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {projectBillableRows.map((g) => (
                      <tr key={g.key}>
                        <td className="px-3 py-2 text-left font-medium text-ink">
                          {g.label || 'Unassigned'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-coral">
                          {formatHoursMinutes(g.billableMinutes)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-navy">
                          {formatHoursMinutes(g.nonBillableMinutes)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">
                          {formatHoursMinutes(g.durationMinutes)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate">
                          {billablePct(g.billableMinutes, g.durationMinutes)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {taskBillableRows.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate">
                By task
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[32rem] table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-slate">
                      <th className="px-3 py-2 text-left font-medium">Task</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Billable
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Non-billable
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Billable %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {taskBillableRows.map((g) => (
                      <tr key={g.key}>
                        <td className="px-3 py-2 text-left font-medium text-ink">
                          {g.label || 'Unassigned'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-coral">
                          {formatHoursMinutes(g.billableMinutes)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-navy">
                          {formatHoursMinutes(g.nonBillableMinutes)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">
                          {formatHoursMinutes(g.durationMinutes)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate">
                          {billablePct(g.billableMinutes, g.durationMinutes)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {commercial && clientProfitRows.length > 0 ? (
        <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Client profitability
            </h2>
            <p className="mt-1 text-sm text-slate">
              Approved time by client — revenue, cost, and margin (independent of
              Group by).
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] table-fixed text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-slate">
                  <th className="px-3 py-2 text-left font-medium">Client</th>
                  <th className="px-3 py-2 text-right font-medium">Hours</th>
                  <th className="px-3 py-2 text-right font-medium">Billable</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="px-3 py-2 text-right font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {clientProfitRows.map((g) => (
                  <tr key={g.key}>
                    <td className="px-3 py-2 text-left font-medium text-ink">
                      {g.label || 'Unassigned'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {formatHoursMinutes(g.durationMinutes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-coral">
                      {formatHoursMinutes(g.billableMinutes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate">
                      {formatMoney(g.revenue, g.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate">
                      {formatMoney(g.cost ?? null, g.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-navy">
                      {formatMoney(g.margin ?? null, g.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate">
                      {g.marginPercent != null
                        ? `${Number(g.marginPercent).toFixed(0)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
