'use client';

import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { InfoTip } from '@/components/common/InfoTip';
import { formatHoursMinutes } from '@/lib/format-duration';
import { CHART_COLORS, nivoTheme } from '@/lib/nivo-theme';
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
        'Billable %': p.billableUtilisationPct ?? 0,
        'Tracked %': p.trackedUtilisationPct ?? 0,
      }))
      .sort((a, b) => b['Billable %'] - a['Billable %']);
  }, [report.people]);

  return (
    <section className="space-y-6 rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          Billable utilisation
        </h2>
        <InfoTip title="Billable utilisation">
          <p>
            Billable hours ÷ available hours (working calendar when set, else
            weekdays × 8h).
          </p>
          <p>
            Uses <strong className="font-medium text-ink">approved</strong> time
            only. Tracked % shows total approved hours vs available for the
            overload split.
          </p>
        </InfoTip>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate">
          No people with approved time in range.
        </p>
      ) : (
        <>
          <div className="h-72">
            <ResponsiveBar
              data={chartData}
              theme={nivoTheme}
              keys={['Billable %', 'Tracked %']}
              indexBy="name"
              groupMode="grouped"
              margin={{ top: 16, right: 16, bottom: 64, left: 40 }}
              padding={0.25}
              colors={[CHART_COLORS.coral, CHART_COLORS.slate]}
              borderRadius={2}
              enableLabel={false}
              axisBottom={{
                tickRotation: -35,
                tickSize: 0,
                tickPadding: 8,
              }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 6,
                format: (v) => `${v}%`,
              }}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'bottom',
                  direction: 'row',
                  translateY: 56,
                  itemWidth: 100,
                  itemHeight: 16,
                  symbolSize: 10,
                  symbolShape: 'circle',
                },
              ]}
              valueFormat={(v) => `${Number(v).toFixed(0)}%`}
            />
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
                  <tr key={row.userId} className="border-b border-navy/10">
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
