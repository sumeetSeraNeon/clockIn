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
import type { BudgetReportResponse } from '@/types/api';

type BudgetReportPanelProps = {
  report: BudgetReportResponse;
};

function fmtHours(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(2)}h`;
}

export function BudgetReportPanel({ report }: BudgetReportPanelProps) {
  const chartData = useMemo(
    () =>
      report.projects.slice(0, 10).map((p) => ({
        name: p.projectName.slice(0, 18),
        budget: p.budgetHours ?? 0,
        estimate: p.estimatedHours,
        actual: p.actualHours,
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
        time in the selected date range. Estimates are current open/done task
        totals.
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
            <YAxis tick={{ fontSize: 11 }} unit="h" />
            <Tooltip />
            <Legend />
            <Bar dataKey="budget" name="Budget" fill="#5f5e5a" radius={2} />
            <Bar dataKey="estimate" name="Estimate" fill="#ba7517" radius={2} />
            <Bar dataKey="actual" name="Actual" fill="#ff494a" radius={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-slate">
              <th className="py-2 pr-3 font-medium">Project</th>
              <th className="py-2 pr-3 font-medium tabular-nums">Budget</th>
              <th className="py-2 pr-3 font-medium tabular-nums">Estimate</th>
              <th className="py-2 pr-3 font-medium tabular-nums">Actual</th>
              <th className="py-2 pr-3 font-medium">Consumed</th>
              <th className="py-2 pr-3 font-medium tabular-nums">Remaining</th>
              <th className="py-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {report.projects.map((row) => {
              const consumedPct =
                row.budgetHours != null && row.budgetHours > 0
                  ? Math.round((row.actualHours / row.budgetHours) * 100)
                  : null;
              return (
                <tr
                  key={row.projectId}
                  className="border-b border-navy/10 align-top"
                >
                  <td className="py-3 pr-3">
                    <p className="font-medium text-navy">{row.projectName}</p>
                    {row.projectCode ? (
                      <p className="text-xs text-slate">{row.projectCode}</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 tabular-nums text-navy">
                    {fmtHours(row.budgetHours)}
                  </td>
                  <td
                    className={`py-3 pr-3 tabular-nums ${
                      row.overBudgetEstimate
                        ? 'font-medium text-coral'
                        : 'text-navy'
                    }`}
                  >
                    {fmtHours(row.estimatedHours)}
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
                    {consumedPct != null ? (
                      <div className="w-28">
                        <div className="mb-1 text-xs tabular-nums text-slate">
                          {consumedPct}%
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                          <div
                            className={`h-full rounded-full ${
                              consumedPct > 100 ? 'bg-coral' : 'bg-navy'
                            }`}
                            style={{
                              width: `${Math.min(consumedPct, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 tabular-nums text-slate">
                    {fmtHours(row.remainingBudgetHours)}
                  </td>
                  <td className="py-3 text-slate">
                    {[
                      row.overBudgetEstimate ? 'Over estimate' : null,
                      row.overBudgetActual ? 'Over actual' : null,
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

      {report.projects.some((p) => p.tasks.some((t) => t.underEstimate)) ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-navy">
            Completed under estimate
          </h3>
          <ul className="divide-y divide-navy/10 border-t border-navy/10">
            {report.projects.flatMap((p) =>
              p.tasks
                .filter((t) => t.underEstimate)
                .map((t) => (
                  <li
                    key={t.taskId}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 text-sm"
                  >
                    <span className="font-medium text-navy">{t.taskName}</span>
                    <span className="text-slate">{p.projectName}</span>
                    <span className="tabular-nums text-slate">
                      {fmtHours(t.actualHours)} / {fmtHours(t.estimatedHours)}
                    </span>
                  </li>
                )),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
