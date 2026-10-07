'use client';

import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { Stat } from '@/app/(app)/dashboard/Stat';
import { InfoTip } from '@/components/common/InfoTip';
import { formatHoursMinutes } from '@/lib/format-duration';
import { formatMoney } from '@/lib/format-money';
import { CHART_COLORS, CHART_PALETTE, nivoTheme } from '@/lib/nivo-theme';
import type { ReportSummaryResponse } from '@/types/api';

type ReportSummaryPanelProps = {
  report: ReportSummaryResponse;
};

export function ReportSummaryPanel({ report }: ReportSummaryPanelProps) {
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
          hours: Number((g.durationMinutes / 60).toFixed(2)),
        })),
    [groups],
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
                Top groups by approved hours
                {reconcile
                  ? ` · ${reconcile.lineCount} line${reconcile.lineCount === 1 ? '' : 's'}`
                  : ''}
                .
              </p>
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
                keys={['hours']}
                indexBy="name"
                layout="horizontal"
                margin={{ top: 4, right: 16, bottom: 24, left: 100 }}
                padding={0.28}
                colors={[CHART_COLORS.coral]}
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
                tooltip={({ indexValue, value }) => (
                  <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm">
                    <span className="font-medium text-navy">{indexValue}</span>
                    {': '}
                    <span className="tabular-nums text-slate">
                      {Number(value).toFixed(2)}h
                    </span>
                  </div>
                )}
              />
            </div>
          )}
        </section>
      </div>

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
                    <span className="text-xs text-slate">
                      {formatHoursMinutes(group.billableMinutes)} billable
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
