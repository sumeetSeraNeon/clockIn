'use client';

import { useMemo, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { Stat } from '@/app/(app)/dashboard/Stat';
import { InfoTip } from '@/components/common/InfoTip';
import { Select } from '@/components/ui/Select';
import { formatHoursMinutes } from '@/lib/format-duration';
import { formatMoney } from '@/lib/format-money';
import { CHART_COLORS, CHART_PALETTE, nivoTheme } from '@/lib/nivo-theme';
import type {
  Member,
  ReportSummaryGroup,
  ReportSummaryResponse,
  UtilisationPersonRow,
} from '@/types/api';

type PerformanceMetric = 'approved' | 'billable' | 'utilisation';

type ReportSummaryPanelProps = {
  report: ReportSummaryResponse;
  /** Fixed groupBy=project for billable table */
  projectGroups?: ReportSummaryGroup[];
  /** Fixed groupBy=task for billable table */
  taskGroups?: ReportSummaryGroup[];
  /** Fixed groupBy=user for top people (hours) */
  userGroups?: ReportSummaryGroup[];
  /** Fixed groupBy=department for top depts (hours) */
  departmentGroups?: ReportSummaryGroup[];
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

function billablePct(billable: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((billable / total) * 100);
}

export function ReportSummaryPanel({
  report,
  projectGroups = [],
  taskGroups = [],
  userGroups = [],
  departmentGroups = [],
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
        .filter((p) => p.utilisationPct != null && Number.isFinite(p.utilisationPct))
        .sort((a, b) => (b.utilisationPct ?? 0) - (a.utilisationPct ?? 0))
        .slice(0, 10)
        .map((p) => ({
          key: p.userId,
          label: p.userName || p.userEmail,
          value: p.utilisationPct ?? 0,
          display: `${(p.utilisationPct ?? 0).toFixed(0)}%`,
        }));
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
    return topByMinutes(
      departmentGroups,
      metric === 'billable' ? 'billableMinutes' : 'durationMinutes',
    );
  }, [metric, members, utilByUserId, departmentGroups]);

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
          Group revenue ({reconcile.groupsRevenue}) does not match totals (
          {totals.revenue}). Check rate lookup.
        </p>
      ) : null}

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
                tooltip={({ id, indexValue, value, data }) => {
                  const billable = Number(data.Billable ?? 0);
                  const nonBillable = Number(data['Non-billable'] ?? 0);
                  const total = billable + nonBillable;
                  return (
                    <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm">
                      <div className="font-medium text-navy">{indexValue}</div>
                      <div className="mt-0.5 tabular-nums text-slate">
                        {String(id)}: {Number(value).toFixed(2)}h
                      </div>
                      <div className="tabular-nums text-slate">
                        Total: {total.toFixed(2)}h
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          )}
        </section>
      </div>

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
              className="min-w-[180px]"
              value={metric}
              onChange={(e) =>
                setMetric(e.target.value as PerformanceMetric)
              }
            >
              <option value="approved">Approved hours</option>
              <option value="billable">Billable hours</option>
              <option value="utilisation">Utilisation %</option>
            </Select>
          </label>
        </div>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate">
              Departments
            </h3>
            {topDepartments.length === 0 ? (
              <p className="mt-2 text-sm text-slate">No data for this metric.</p>
            ) : (
              <ol className="mt-2 divide-y divide-border/60">
                {topDepartments.map((row, i) => (
                  <li
                    key={row.key}
                    className="flex items-baseline justify-between gap-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink">
                      <span className="mr-2 tabular-nums text-slate">
                        {i + 1}.
                      </span>
                      {row.label}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-navy">
                      {row.display}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate">
              People
            </h3>
            {topPeople.length === 0 ? (
              <p className="mt-2 text-sm text-slate">No data for this metric.</p>
            ) : (
              <ol className="mt-2 divide-y divide-border/60">
                {topPeople.map((row, i) => (
                  <li
                    key={row.key}
                    className="flex items-baseline justify-between gap-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink">
                      <span className="mr-2 tabular-nums text-slate">
                        {i + 1}.
                      </span>
                      {row.label}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-navy">
                      {row.display}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {(projectBillableRows.length > 0 || taskBillableRows.length > 0) && (
        <section className="space-y-4 rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Billable breakdown
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
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-slate">
                      <th className="py-2 pr-3 font-medium">Project</th>
                      <th className="py-2 pr-3 font-medium">Billable</th>
                      <th className="py-2 pr-3 font-medium">Non-billable</th>
                      <th className="py-2 pr-3 font-medium">Total</th>
                      <th className="py-2 font-medium">Billable %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {projectBillableRows.map((g) => (
                      <tr key={g.key}>
                        <td className="py-2 pr-3 font-medium text-ink">
                          {g.label || 'Unassigned'}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-coral">
                          {formatHoursMinutes(g.billableMinutes)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-navy">
                          {formatHoursMinutes(g.nonBillableMinutes)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-ink">
                          {formatHoursMinutes(g.durationMinutes)}
                        </td>
                        <td className="py-2 tabular-nums text-slate">
                          {billablePct(
                            g.billableMinutes,
                            g.durationMinutes,
                          )}
                          %
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
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-slate">
                      <th className="py-2 pr-3 font-medium">Task</th>
                      <th className="py-2 pr-3 font-medium">Billable</th>
                      <th className="py-2 pr-3 font-medium">Non-billable</th>
                      <th className="py-2 pr-3 font-medium">Total</th>
                      <th className="py-2 font-medium">Billable %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {taskBillableRows.map((g) => (
                      <tr key={g.key}>
                        <td className="py-2 pr-3 font-medium text-ink">
                          {g.label || 'Unassigned'}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-coral">
                          {formatHoursMinutes(g.billableMinutes)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-navy">
                          {formatHoursMinutes(g.nonBillableMinutes)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-ink">
                          {formatHoursMinutes(g.durationMinutes)}
                        </td>
                        <td className="py-2 tabular-nums text-slate">
                          {billablePct(
                            g.billableMinutes,
                            g.durationMinutes,
                          )}
                          %
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

      {groups.length > 0 ? (
        <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            {showProfitability ? 'Profitability' : 'Breakdown'}
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
                        backgroundColor:
                          CHART_PALETTE[index % CHART_PALETTE.length],
                      }}
                    />
                    <span className="truncate font-medium text-ink">
                      {group.label || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-baseline gap-3 tabular-nums">
                    <span className="text-xs text-coral">
                      {formatHoursMinutes(group.billableMinutes)} billable
                    </span>
                    <span className="text-xs text-navy">
                      {formatHoursMinutes(group.nonBillableMinutes)}{' '}
                      non-billable
                    </span>
                    {commercial && group.revenue != null ? (
                      <span className="text-xs text-slate">
                        Rev {formatMoney(group.revenue, group.currency)}
                      </span>
                    ) : null}
                    {commercial && group.cost != null ? (
                      <span className="text-xs text-slate">
                        Cost {formatMoney(group.cost, group.currency)}
                      </span>
                    ) : null}
                    {commercial && group.margin != null ? (
                      <span className="text-xs font-medium text-navy">
                        Margin {formatMoney(group.margin, group.currency)}
                        {group.marginPercent != null
                          ? ` (${Number(group.marginPercent).toFixed(0)}%)`
                          : ''}
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
