'use client';

import { useMemo } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { ApprovalsReportResponse } from '@/types/api';

type ApprovalsReportPanelProps = {
  report: ApprovalsReportResponse;
};

function statusLabel(status: string) {
  if (status === 'submitted') return 'Waiting';
  return status.replace(/_/g, ' ');
}

function daysBetween(from: string | null, to: string | null): number | null {
  if (!from) return null;
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

function agingBucket(days: number | null): string {
  if (days == null) return 'unknown';
  if (days <= 2) return '0–2 days';
  if (days <= 7) return '3–7 days';
  return '8+ days';
}

export function ApprovalsReportPanel({ report }: ApprovalsReportPanelProps) {
  const funnelData = useMemo(
    () =>
      [
        {
          name: 'Waiting',
          value: report.counts.submitted,
          fill: '#ba7517',
        },
        {
          name: 'Approved',
          value: report.counts.approved,
          fill: '#1d9e75',
        },
        {
          name: 'Rejected',
          value: report.counts.rejected,
          fill: '#ff494a',
        },
      ].filter((d) => d.value > 0),
    [report.counts],
  );

  const aging = useMemo(() => {
    const buckets = { '0–2 days': 0, '3–7 days': 0, '8+ days': 0, unknown: 0 };
    for (const row of report.slices) {
      if (row.status !== 'submitted') continue;
      const d = daysBetween(row.submittedAt, null);
      buckets[agingBucket(d) as keyof typeof buckets] += 1;
    }
    return buckets;
  }, [report.slices]);

  const waitingCount = report.counts.submitted;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border/80 bg-card px-5 py-5">
          <h2 className="text-base font-semibold text-ink">Pipeline</h2>
          <p className="mt-1 text-sm text-slate">
            Timesheet period slices in range
          </p>
          {funnelData.length === 0 ? (
            <p className="mt-8 text-sm text-slate">No slices in this range.</p>
          ) : (
            <div className="mt-2 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={funnelData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {funnelData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate">
                Waiting
              </p>
              <p className="tabular-nums text-lg font-semibold text-navy">
                {report.counts.submitted}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate">
                Approved
              </p>
              <p className="tabular-nums text-lg font-semibold text-navy">
                {report.counts.approved}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate">
                Rejected
              </p>
              <p className="tabular-nums text-lg font-semibold text-navy">
                {report.counts.rejected}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border/80 bg-card px-5 py-5">
          <h2 className="text-base font-semibold text-ink">
            Waiting backlog age
          </h2>
          <p className="mt-1 text-sm text-slate">
            {waitingCount} slice{waitingCount === 1 ? '' : 's'} still waiting
          </p>
          <ul className="mt-6 space-y-3">
            {(
              [
                ['0–2 days', aging['0–2 days']],
                ['3–7 days', aging['3–7 days']],
                ['8+ days', aging['8+ days']],
              ] as const
            ).map(([label, count]) => (
              <li key={label} className="flex items-center justify-between text-sm">
                <span className="text-slate">{label}</span>
                <span className="font-medium tabular-nums text-navy">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {report.slices.length === 0 ? (
        <p className="text-sm text-slate">No approval slices in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-slate">
                <th className="py-2 pr-3 font-medium">Member</th>
                <th className="py-2 pr-3 font-medium">Project</th>
                <th className="py-2 pr-3 font-medium">Manager</th>
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Submitted</th>
                <th className="py-2 pr-3 font-medium">Decided</th>
                <th className="py-2 font-medium">Days</th>
              </tr>
            </thead>
            <tbody>
              {report.slices.map((row) => {
                const waiting =
                  row.status === 'submitted'
                    ? daysBetween(row.submittedAt, null)
                    : null;
                const turnaround =
                  row.status !== 'submitted'
                    ? daysBetween(row.submittedAt, row.decidedAt)
                    : null;
                const days = waiting ?? turnaround;
                return (
                  <tr
                    key={row.sliceId}
                    className="border-b border-navy/10 align-top"
                  >
                    <td className="py-3 pr-3">
                      <p className="font-medium text-navy">{row.memberName}</p>
                      <p className="text-xs text-slate">{row.memberEmail}</p>
                    </td>
                    <td className="py-3 pr-3 text-navy">{row.projectName}</td>
                    <td className="py-3 pr-3 text-slate">
                      {row.managerName ?? '—'}
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-slate">
                      {row.periodStart && row.periodEnd
                        ? `${row.periodStart} – ${row.periodEnd}`
                        : '—'}
                    </td>
                    <td className="py-3 pr-3 capitalize text-navy">
                      {statusLabel(row.status)}
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-slate">
                      {formatDate(row.submittedAt)}
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-slate">
                      {formatDate(row.decidedAt)}
                    </td>
                    <td className="py-3 tabular-nums text-navy">
                      {days != null
                        ? row.status === 'submitted'
                          ? `${days}d waiting`
                          : `${days}d turnaround`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
