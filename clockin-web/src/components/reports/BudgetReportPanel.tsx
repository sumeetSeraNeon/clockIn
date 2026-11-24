'use client';

import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { Stat } from '@/app/(app)/dashboard/Stat';
import { InfoTip } from '@/components/common/InfoTip';
import { formatDisplayDate } from '@/lib/date-range';
import { CHART_COLORS, nivoTheme } from '@/lib/nivo-theme';
import type { BudgetReportResponse, BudgetReportProjectRow } from '@/types/api';

type BudgetReportPanelProps = {
  report: BudgetReportResponse;
};

function fmtHours(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(2)}h`;
}

function fmtPct(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(0)}%`;
}

function signalLabel(signal: BudgetReportProjectRow['burnSignal']) {
  switch (signal) {
    case 'on_track':
      return {
        text: 'On track',
        className: 'bg-success/10 text-success',
      };
    case 'watch':
      return {
        text: 'Watch',
        className: 'bg-amber-100 text-amber-800',
      };
    case 'overrunning':
      return {
        text: 'Overrunning',
        className: 'bg-coral/15 text-coral',
      };
    default:
      return { text: '—', className: 'bg-muted text-slate' };
  }
}

function rowFlags(row: BudgetReportProjectRow): string {
  if (row.budgetHours == null) return 'No budget set';
  const parts = [
    row.overBudgetEstimate ? 'Over estimate' : null,
    row.overBudgetActual ? 'Over budget' : null,
    row.tasks.some((t) => t.underEstimate) ? 'Under-estimate tasks' : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/**
 * Budget burn vs timeline — Summary-style KPIs, horizontal chart, aligned table.
 */
export function BudgetReportPanel({ report }: BudgetReportPanelProps) {
  const withBudget = useMemo(
    () => report.projects.filter((p) => p.budgetHours != null),
    [report.projects],
  );

  const kpis = useMemo(() => {
    const overBudget = report.projects.filter((p) => p.overBudgetActual).length;
    let onTrack = 0;
    let watch = 0;
    let overrunning = 0;
    for (const p of withBudget) {
      if (p.burnSignal === 'on_track') onTrack += 1;
      else if (p.burnSignal === 'watch') watch += 1;
      else if (p.burnSignal === 'overrunning') overrunning += 1;
    }
    return {
      total: report.projects.length,
      withBudget: withBudget.length,
      overBudget,
      onTrack,
      watch,
      overrunning,
    };
  }, [report.projects, withBudget]);

  const chartData = useMemo(
    () =>
      withBudget.slice(0, 12).map((p) => ({
        name: (p.projectName || 'Project').slice(0, 22),
        'Budget burn %': Number(p.budgetBurnPct ?? 0),
        'Timeline %': Number(p.timelineElapsedPct ?? 0),
      })),
    [withBudget],
  );

  if (report.projects.length === 0) {
    return (
      <p className="text-sm text-slate">No projects in scope for this range.</p>
    );
  }

  const signalHint =
    kpis.onTrack + kpis.watch + kpis.overrunning > 0
      ? `${kpis.onTrack} on track · ${kpis.watch} watch · ${kpis.overrunning} overrunning`
      : 'Needs start/end dates and a budget';

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <p className="text-sm text-slate">
          Budget burn vs timeline for projects in this range (
          {report.entryStatus} time).
        </p>
        <InfoTip title="Budget burn vs timeline" align="end">
          <p>
            Actual hours use{' '}
            <strong className="font-medium text-ink">{report.entryStatus}</strong>{' '}
            time in the selected date range.
          </p>
          <p>
            Burn % is actual hours vs project budget. Timeline % is how far the
            project calendar has elapsed (start→end as of date to).
          </p>
          <p>
            Watch when burn leads timeline by &gt;10pp; Overrunning when &gt;25pp
            or over budget.
          </p>
        </InfoTip>
      </div>

      <div className="grid gap-6 rounded-lg border border-border/80 bg-card px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-7 lg:grid-cols-4">
        <Stat label="Projects" value={String(kpis.total)} hint="In this range" />
        <Stat
          label="With budget"
          value={String(kpis.withBudget)}
          hint="Budget hours set"
        />
        <Stat
          label="Over budget"
          value={String(kpis.overBudget)}
          hint="Actual exceeds budget"
          accent={kpis.overBudget > 0}
        />
        <Stat label="Signals" value={String(kpis.onTrack + kpis.watch + kpis.overrunning)} hint={signalHint} />
      </div>

      <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          Budget burn
        </h2>
        <p className="mt-1 text-sm text-slate">
          Projects with a budget — burn % vs timeline % (top 12).
        </p>
        {chartData.length === 0 ? (
          <p className="mt-8 text-sm text-slate">
            Set budget hours on projects to see burn vs timeline.
          </p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveBar
              data={chartData}
              theme={nivoTheme}
              keys={['Budget burn %', 'Timeline %']}
              indexBy="name"
              layout="horizontal"
              groupMode="grouped"
              margin={{ top: 8, right: 24, bottom: 40, left: 120 }}
              padding={0.28}
              colors={[CHART_COLORS.navy, CHART_COLORS.coral]}
              borderRadius={2}
              enableLabel={false}
              axisBottom={{
                tickSize: 0,
                tickPadding: 6,
                format: (v) => `${v}%`,
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
                  itemWidth: 120,
                  itemHeight: 14,
                  symbolSize: 10,
                  symbolShape: 'circle',
                },
              ]}
              valueFormat={(v) => `${Number(v).toFixed(0)}%`}
              tooltip={({ id, indexValue, data }) => {
                const burn = Number(data['Budget burn %'] ?? 0);
                const timeline = Number(data['Timeline %'] ?? 0);
                const active = String(id);
                return (
                  <div className="min-w-[12rem] rounded-lg border border-border bg-white px-3 py-2.5 text-sm shadow-[0_4px_16px_rgba(20,20,43,0.12)]">
                    <div className="font-semibold text-navy">{indexValue}</div>
                    <dl className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between gap-6">
                        <dt
                          className={
                            active === 'Budget burn %'
                              ? 'font-medium text-navy'
                              : 'text-slate'
                          }
                        >
                          Budget burn
                        </dt>
                        <dd className="tabular-nums text-ink">
                          {burn.toFixed(0)}%
                        </dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt
                          className={
                            active === 'Timeline %'
                              ? 'font-medium text-coral'
                              : 'text-slate'
                          }
                        >
                          Timeline
                        </dt>
                        <dd className="tabular-nums text-ink">
                          {timeline.toFixed(0)}%
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

      <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          Projects
        </h2>
        <p className="mt-1 text-sm text-slate">
          Hours, burn, timeline, and delivery signals.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[48rem] table-fixed text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-slate">
                <th className="px-3 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2 text-right font-medium">Budget</th>
                <th className="px-3 py-2 text-right font-medium">Actual</th>
                <th className="px-3 py-2 text-right font-medium">Burn %</th>
                <th className="px-3 py-2 text-right font-medium">Timeline %</th>
                <th className="px-3 py-2 text-left font-medium">Signal</th>
                <th className="px-3 py-2 text-right font-medium">Remaining</th>
                <th className="px-3 py-2 text-left font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {report.projects.map((row) => {
                const signal = signalLabel(row.burnSignal);
                const hasBudget = row.budgetHours != null;
                return (
                  <tr key={row.projectId}>
                    <td className="px-3 py-2.5 text-left">
                      <p className="font-medium text-ink">{row.projectName}</p>
                      <p className="text-xs text-slate">
                        {[
                          row.projectCode,
                          row.startDate
                            ? formatDisplayDate(row.startDate)
                            : null,
                          row.endDate ? formatDisplayDate(row.endDate) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'No dates'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                      {fmtHours(row.budgetHours)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        row.overBudgetActual
                          ? 'font-medium text-coral'
                          : 'text-ink'
                      }`}
                    >
                      {fmtHours(row.actualHours)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate">
                      {hasBudget ? fmtPct(row.budgetBurnPct) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate">
                      {hasBudget ? fmtPct(row.timelineElapsedPct) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-left">
                      {hasBudget && row.burnSignal && row.burnSignal !== 'unknown' ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${signal.className}`}
                        >
                          {signal.text}
                        </span>
                      ) : (
                        <span className="text-slate">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate">
                      {fmtHours(row.remainingBudgetHours)}
                    </td>
                    <td className="px-3 py-2.5 text-left text-slate">
                      {rowFlags(row)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
