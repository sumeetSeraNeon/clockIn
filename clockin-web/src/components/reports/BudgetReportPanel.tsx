'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
      return { text: 'On track', className: 'text-success' };
    case 'watch':
      return { text: 'Watch', className: 'text-amber-700' };
    case 'overrunning':
      return { text: 'Overrunning', className: 'text-coral' };
    default:
      return { text: '—', className: 'text-slate' };
  }
}

function BurnBar({
  burnPct,
  timelinePct,
}: {
  burnPct: number | null | undefined;
  timelinePct: number | null | undefined;
}) {
  if (burnPct == null && timelinePct == null) {
    return <span className="text-slate">—</span>;
  }
  const burn = Math.max(0, burnPct ?? 0);
  const timeline = Math.max(0, timelinePct ?? 0);
  return (
    <div className="w-36 space-y-1">
      <div className="flex justify-between text-[11px] tabular-nums text-slate">
        <span>Burn {fmtPct(burnPct)}</span>
        <span>Time {fmtPct(timelinePct)}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-paper">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-navy/80"
          style={{ width: `${Math.min(burn, 100)}%` }}
        />
        {timelinePct != null ? (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-coral"
            style={{ left: `${Math.min(timeline, 100)}%` }}
            title={`Timeline ${fmtPct(timelinePct)}`}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * STEP 3 Rank 2 — budget burn vs timeline with on-track / watch / overrun.
 */
export function BudgetReportPanel({ report }: BudgetReportPanelProps) {
  const chartData = useMemo(
    () =>
      report.projects.slice(0, 10).map((p) => ({
        name: p.projectName.slice(0, 18),
        budgetBurn: p.budgetBurnPct ?? 0,
        timeline: p.timelineElapsedPct ?? 0,
      })),
    [report.projects],
  );

  if (report.projects.length === 0) {
    return (
      <p className="text-sm text-slate">No projects in scope for this range.</p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate">
        Actual hours use{' '}
        <span className="font-medium text-navy">{report.entryStatus}</span>{' '}
        time in the selected date range. Burn % is hours vs budget; the marker
        is % of project timeline elapsed (start→end as of date to). Amber when
        burn leads timeline by &gt;10pp; red when &gt;25pp or over budget.
      </p>

      <div className="h-72 rounded-lg border border-border/80 bg-card px-3 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-30}
              textAnchor="end"
              height={55}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="budgetBurn"
              name="Budget burn %"
              fill="#14142b"
              radius={2}
            />
            <Bar
              dataKey="timeline"
              name="Timeline %"
              fill="#ff494a"
              radius={2}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-slate">
              <th className="py-2 pr-3 font-medium">Project</th>
              <th className="py-2 pr-3 font-medium tabular-nums">Budget</th>
              <th className="py-2 pr-3 font-medium tabular-nums">Actual</th>
              <th className="py-2 pr-3 font-medium">Burn vs timeline</th>
              <th className="py-2 pr-3 font-medium">Signal</th>
              <th className="py-2 pr-3 font-medium tabular-nums">Remaining</th>
              <th className="py-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {report.projects.map((row) => {
              const signal = signalLabel(row.burnSignal);
              return (
                <tr
                  key={row.projectId}
                  className="border-b border-navy/10 align-top"
                >
                  <td className="py-3 pr-3">
                    <p className="font-medium text-navy">{row.projectName}</p>
                    <p className="text-xs text-slate">
                      {[row.projectCode, row.startDate, row.endDate]
                        .filter(Boolean)
                        .join(' · ') || 'No dates'}
                    </p>
                  </td>
                  <td className="py-3 pr-3 tabular-nums text-navy">
                    {fmtHours(row.budgetHours)}
                  </td>
                  <td
                    className={`py-3 pr-3 tabular-nums ${
                      row.overBudgetActual
                        ? 'font-medium text-coral'
                        : 'text-navy'
                    }`}
                  >
                    {fmtHours(row.actualHours)}
                  </td>
                  <td className="py-3 pr-3">
                    <BurnBar
                      burnPct={row.budgetBurnPct}
                      timelinePct={row.timelineElapsedPct}
                    />
                  </td>
                  <td className={`py-3 pr-3 text-sm font-medium ${signal.className}`}>
                    {signal.text}
                  </td>
                  <td className="py-3 pr-3 tabular-nums text-slate">
                    {fmtHours(row.remainingBudgetHours)}
                  </td>
                  <td className="py-3 text-slate">
                    {[
                      row.overBudgetEstimate ? 'Over estimate' : null,
                      row.overBudgetActual ? 'Over budget' : null,
                      row.tasks.some((t) => t.underEstimate)
                        ? 'Under-estimate tasks'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
