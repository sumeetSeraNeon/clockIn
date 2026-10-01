'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { UtilisationReportResponse } from '@/types/api';

type UtilisationPanelProps = {
  report: UtilisationReportResponse;
};

/**
 * STEP 3 — billable utilisation: billable ÷ available (calendar or weekday×8).
 * Also shows tracked utilisation for the split.
 */
export function UtilisationPanel({ report }: UtilisationPanelProps) {
  const chartData = useMemo(() => {
    return [...report.people]
      .map((p) => ({
        name: (p.userName || p.userEmail || 'Person').slice(0, 18),
        billableUtil: p.billableUtilisationPct ?? 0,
        trackedUtil: p.trackedUtilisationPct ?? 0,
        trackedMinutes: p.trackedMinutes,
        billableMinutes: p.billableMinutes,
        overload: (p.trackedUtilisationPct ?? 0) > 100,
      }))
      .sort((a, b) => b.billableUtil - a.billableUtil);
  }, [report.people]);

  return (
    <section className="space-y-6 rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink">
          Billable utilisation
        </h2>
        <p className="mt-1 text-sm text-slate">
          Billable hours ÷ available hours (working calendar when set, else
          weekdays × 8h). Approved time only · tracked vs billable shown for
          split.
        </p>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate">No people with approved time in range.</p>
      ) : (
        <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  unit="%"
                  domain={[0, (dataMax: number) => Math.max(120, dataMax)]}
                />
                <Tooltip />
                <Bar
                  dataKey="billableUtil"
                  name="Billable %"
                  fill="#ff494a"
                  radius={2}
                />
                <Bar
                  dataKey="trackedUtil"
                  name="Tracked %"
                  fill="#5f5e5a"
                  radius={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-3 font-medium">Person</th>
                  <th className="py-2 pr-3 font-medium tabular-nums">
                    Tracked
                  </th>
                  <th className="py-2 pr-3 font-medium tabular-nums">
                    Billable
                  </th>
                  <th className="py-2 pr-3 font-medium tabular-nums">
                    Available
                  </th>
                  <th className="py-2 pr-3 font-medium tabular-nums">
                    Billable %
                  </th>
                  <th className="py-2 font-medium tabular-nums">Tracked %</th>
                </tr>
              </thead>
              <tbody>
                {report.people.map((row) => (
                  <tr
                    key={row.userId}
                    className="border-b border-navy/10"
                  >
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-navy">
                        {row.userName || row.userEmail}
                      </p>
                      <p className="text-xs text-slate">
                        {row.calendarSource === 'weekday_fallback'
                          ? 'Weekday × 8h'
                          : row.calendarSource === 'user'
                            ? 'User calendar'
                            : 'Org calendar'}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-navy">
                      {formatHoursMinutes(row.trackedMinutes)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-navy">
                      {formatHoursMinutes(row.billableMinutes)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate">
                      {row.availableHours}h
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums font-medium text-navy">
                      {row.billableUtilisationPct != null
                        ? `${row.billableUtilisationPct}%`
                        : '—'}
                    </td>
                    <td
                      className={`py-2.5 tabular-nums ${
                        (row.trackedUtilisationPct ?? 0) > 100
                          ? 'font-medium text-coral'
                          : 'text-slate'
                      }`}
                    >
                      {row.trackedUtilisationPct != null
                        ? `${row.trackedUtilisationPct}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
