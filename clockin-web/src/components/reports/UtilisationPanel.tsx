'use client';

import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { EmptyState } from '@/components/common/EmptyState';
import { InfoTip } from '@/components/common/InfoTip';
import { formatDisplayYearMonth } from '@/lib/date-range';
import { CHART_COLORS, nivoTheme } from '@/lib/nivo-theme';
import type { UtilisationReportResponse } from '@/types/api';

type UtilisationPanelProps = {
  report: UtilisationReportResponse;
};

/**
 * Utilisation sheet: approved tracked ÷ (planned − leave×8).
 */
export function UtilisationPanel({ report }: UtilisationPanelProps) {
  const missingCapacity =
    report.missingCapacity === true || report.plannedHours == null;

  const chartData = useMemo(() => {
    if (missingCapacity) return [];
    return [...report.people]
      .map((p) => ({
        name: (p.userName || p.userEmail || 'Person').slice(0, 18),
        'Util %': p.utilisationPct ?? 0,
      }))
      .sort((a, b) => b['Util %'] - a['Util %']);
  }, [missingCapacity, report.people]);

  if (missingCapacity) {
    return (
      <EmptyState
        title="Set monthly capacity"
        description={`Add planned hours for ${formatDisplayYearMonth(report.yearMonth)} in Settings → Organisation before viewing utilisation.`}
      />
    );
  }

  return (
    <section className="space-y-6 rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Utilisation
          </h2>
          <InfoTip title="Utilisation">
            <p>
              Available hours = planned hours − leave days × 8. Utilisation =
              approved tracked hours ÷ available × 100.
            </p>
            <p>
              Planned hours are set in Settings for the month. Leave days are
              entered on Team. Department, person, and manager narrow who
              appears. Client or project only changes tracked hours (planned
              and leave stay full-month).
            </p>
          </InfoTip>
        </div>
        <p className="text-sm text-slate">
          {formatDisplayYearMonth(report.yearMonth)} · planned{' '}
          {report.plannedHours}h
        </p>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate">No active people in scope.</p>
      ) : (
        <>
          <div className="h-72">
            <ResponsiveBar
              data={chartData}
              theme={nivoTheme}
              keys={['Util %']}
              indexBy="name"
              margin={{ top: 16, right: 16, bottom: 64, left: 40 }}
              padding={0.3}
              colors={[CHART_COLORS.coral]}
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
              valueFormat={(v) => `${Number(v).toFixed(0)}%`}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-3 font-medium">Resource</th>
                  <th className="py-2 pr-3 font-medium tabular-nums">Hours</th>
                  <th className="py-2 pr-3 font-medium tabular-nums">Leave</th>
                  <th className="py-2 pr-3 font-medium tabular-nums">
                    Leave hours
                  </th>
                  <th className="py-2 pr-3 font-medium tabular-nums">Total</th>
                  <th className="py-2 pr-3 font-medium tabular-nums">
                    Time tracked
                  </th>
                  <th className="py-2 font-medium tabular-nums">Util %</th>
                </tr>
              </thead>
              <tbody>
                {report.people.map((row) => (
                  <tr key={row.userId} className="border-b border-navy/10">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-navy">
                        {row.userName || row.userEmail}
                      </p>
                      {row.userName ? (
                        <p className="text-xs text-slate">{row.userEmail}</p>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-navy">
                      {row.plannedHours}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-navy">
                      {row.leaveDays}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate">
                      {row.leaveHours}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-navy">
                      {row.availableHours}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-navy">
                      {row.trackedHours}
                    </td>
                    <td
                      className={`py-2.5 tabular-nums font-medium ${
                        (row.utilisationPct ?? 0) > 100
                          ? 'text-coral'
                          : 'text-navy'
                      }`}
                    >
                      {row.utilisationPct != null
                        ? `${row.utilisationPct}%`
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
