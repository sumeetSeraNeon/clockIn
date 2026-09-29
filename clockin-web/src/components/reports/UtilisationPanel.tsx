'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Select } from '@/components/ui/Select';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { ReportSummaryGroup } from '@/types/api';

type UtilisationPanelProps = {
  groups: ReportSummaryGroup[];
  dateFrom: string;
  dateTo: string;
  hoursPerDay?: number;
};

/** Count Mon–Fri days inclusive between two YYYY-MM-DD dates. */
function workingDaysBetween(dateFrom: string, dateTo: string): number {
  const start = new Date(`${dateFrom}T12:00:00`);
  const end = new Date(`${dateTo}T12:00:00`);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(count, 1);
}

/**
 * Utilisation estimate: tracked ÷ (weekdays × hours/day).
 * Also shows billable utilisation.
 */
export function UtilisationPanel({
  groups,
  dateFrom,
  dateTo,
  hoursPerDay: hoursPerDayProp = 8,
}: UtilisationPanelProps) {
  const [hoursPerDay, setHoursPerDay] = useState(hoursPerDayProp);
  const days = workingDaysBetween(dateFrom, dateTo);
  const capacityMinutes = days * hoursPerDay * 60;

  const chartData = useMemo(() => {
    return [...groups]
      .map((g) => {
        const util = Math.round((g.durationMinutes / capacityMinutes) * 100);
        const billableUtil = Math.round(
          (g.billableMinutes / capacityMinutes) * 100,
        );
        return {
          name: (g.label || 'Unassigned').slice(0, 18),
          utilisation: util,
          billableUtil,
          trackedMinutes: g.durationMinutes,
          overload: util > 100,
        };
      })
      .sort((a, b) => b.utilisation - a.utilisation);
  }, [groups, capacityMinutes]);

  return (
    <section className="space-y-6 rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Utilisation (estimate)
          </h2>
          <p className="mt-1 text-sm text-slate">
            Tracked ÷ {days} working day{days === 1 ? '' : 's'} × {hoursPerDay}
            h (weekdays only — not linked to working calendars yet).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate">
          Hours / day
          <Select
            className="w-20"
            value={String(hoursPerDay)}
            onChange={(e) => setHoursPerDay(Number(e.target.value))}
          >
            {[6, 7, 7.5, 8, 9].map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate">No people with time in range.</p>
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
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === 'utilisation' ? 'Total util' : 'Billable util',
                  ]}
                />
                <Bar
                  dataKey="utilisation"
                  name="utilisation"
                  fill="#ff494a"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="billableUtil"
                  name="billableUtil"
                  fill="#14142b"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="divide-y divide-border/60">
            {chartData.map((row) => (
              <li
                key={row.name}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-ink">{row.name}</p>
                  <p className="text-xs text-slate">
                    {formatHoursMinutes(row.trackedMinutes)} tracked ·{' '}
                    {formatHoursMinutes(capacityMinutes)} capacity
                  </p>
                </div>
                <div className="tabular-nums text-right">
                  <p
                    className={
                      row.overload
                        ? 'font-semibold text-coral'
                        : 'font-medium text-navy'
                    }
                  >
                    {row.utilisation}%
                  </p>
                  <p className="text-xs text-slate">
                    {row.billableUtil}% billable
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
