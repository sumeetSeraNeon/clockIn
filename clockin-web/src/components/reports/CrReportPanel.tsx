'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { Stat } from '@/app/(app)/dashboard/Stat';
import { InfoTip } from '@/components/common/InfoTip';
import { formatHoursMinutes } from '@/lib/format-duration';
import { formatMoney } from '@/lib/format-money';
import { CHART_COLORS, CHART_PALETTE, nivoTheme } from '@/lib/nivo-theme';
import {
  CR_APPROVAL_STATUS_LABELS,
  type CrApprovalStatus,
  type CrReportResponse,
  type CrReportTicketRow,
} from '@/types/api';

type CrReportPanelProps = {
  report: CrReportResponse;
};

const AGING_LABELS: Record<string, string> = {
  '0_30': '0–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  '90_plus': '90+ days',
};

function approvalLabel(status: string) {
  return (
    CR_APPROVAL_STATUS_LABELS[status as CrApprovalStatus] ??
    status.replace(/_/g, ' ')
  );
}

function marginSignal(row: CrReportTicketRow): {
  text: string;
  className: string;
} {
  if (row.crValue == null || row.cost == null) {
    return { text: '—', className: 'text-slate' };
  }
  const value = Number(row.crValue);
  const cost = Number(row.cost);
  if (!Number.isFinite(value) || !Number.isFinite(cost)) {
    return { text: '—', className: 'text-slate' };
  }
  if (cost > value) {
    return { text: 'Overrun', className: 'text-coral' };
  }
  if (value > 0 && cost / value >= 0.85) {
    return { text: 'Thin', className: 'text-amber-700' };
  }
  return { text: 'Healthy', className: 'text-success' };
}

/**
 * Change Request dashboard — value KPIs, aging, rate profit, sold value vs cost.
 */
export function CrReportPanel({ report }: CrReportPanelProps) {
  const commercial = report.commercial === true;
  const currency = report.currency;
  const { kpis } = report;

  const approvalPie = useMemo(
    () =>
      report.byApproval
        .filter((s) => s.count > 0)
        .map((s, i) => ({
          id: approvalLabel(s.status),
          label: approvalLabel(s.status),
          value: s.count,
          color: CHART_PALETTE[i % CHART_PALETTE.length],
        })),
    [report.byApproval],
  );

  const agingBars = useMemo(
    () =>
      report.aging.map((a) => ({
        bucket: AGING_LABELS[a.bucket] ?? a.bucket,
        Open: a.count,
        valueLabel: a.value ?? '',
      })),
    [report.aging],
  );

  const personBars = useMemo(
    () =>
      [...report.byPerson].slice(0, 12).map((p) => ({
        name: p.label.slice(0, 22),
        Revenue: Number(p.revenue ?? 0),
        Cost: Number(p.cost ?? 0),
        Hours: Number((p.approvedMinutes / 60).toFixed(2)),
      })),
    [report.byPerson],
  );

  const deptBars = useMemo(
    () =>
      [...report.byDepartment].slice(0, 12).map((d) => ({
        name: d.label.slice(0, 22),
        Revenue: Number(d.revenue ?? 0),
        Cost: Number(d.cost ?? 0),
        Hours: Number((d.approvedMinutes / 60).toFixed(2)),
      })),
    [report.byDepartment],
  );

  const kpiMoney = (amount: string | null, count: number) => {
    if (commercial && amount != null) {
      return formatMoney(amount, currency);
    }
    return String(count);
  };

  if (
    kpis.openedInRangeCount === 0 &&
    report.tickets.length === 0 &&
    report.aging.every((a) => a.count === 0)
  ) {
    return (
      <p className="text-sm text-slate">
        No Change Requests match these filters for the selected range.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <p className="text-sm text-slate">
          {commercial
            ? 'CR values for tickets opened in range; aging for still-open CRs; profit from approved time on Change Requests.'
            : 'Counts and hours for Change Requests. Money needs rate access.'}
        </p>
        <InfoTip title="How the CR dashboard works" align="end">
          <p>
            <strong className="font-medium text-ink">Value cards</strong> use
            Change Requests opened in the date range.
          </p>
          <p>
            <strong className="font-medium text-ink">Aging</strong> shows
            still-open CRs (not closed/resolved), regardless of open date.
          </p>
          <p>
            <strong className="font-medium text-ink">Hours &amp; profit</strong>{' '}
            use approved time logged in the range on CR tickets. Person filter
            scopes time only.
          </p>
          {commercial ? (
            <p>
              Sold value vs cost compares CR value to cost of approved hours.
              Revenue/cost by person and department use the same rate rules as
              Summary.
            </p>
          ) : null}
        </InfoTip>
      </div>

      {report.mixedCurrencies ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Mixed currencies in this set — totals may mix codes; see per-CR
          currency where shown.
        </p>
      ) : null}

      <div className="grid gap-6 rounded-lg border border-border/80 bg-card px-5 py-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat
          label={commercial ? 'Total CR value' : 'CRs opened'}
          value={kpiMoney(kpis.totalValue, kpis.totalCount)}
          hint={`${kpis.openedInRangeCount} opened in range`}
          accent
        />
        <Stat
          label={commercial ? 'Pending value' : 'Pending'}
          value={kpiMoney(kpis.pendingValue, kpis.pendingCount)}
          hint={`${kpis.pendingCount} tickets`}
        />
        <Stat
          label={commercial ? 'On hold value' : 'On hold'}
          value={kpiMoney(kpis.holdValue, kpis.holdCount)}
          hint={`${kpis.holdCount} tickets`}
        />
        <Stat
          label={commercial ? 'In delivery value' : 'In delivery'}
          value={kpiMoney(kpis.inDeliveryValue, kpis.inDeliveryCount)}
          hint={`${kpis.inDeliveryCount} tickets`}
        />
        <Stat
          label={commercial ? 'Rejected value' : 'Rejected'}
          value={kpiMoney(kpis.rejectedValue, kpis.rejectedCount)}
          hint={`${kpis.rejectedCount} tickets`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/80 bg-card px-4 py-4">
          <h3 className="text-sm font-semibold text-ink">Approval mix</h3>
          <p className="mt-0.5 text-xs text-slate">
            Opened in range by CR approval status
          </p>
          <div className="mt-2 h-64">
            {approvalPie.length === 0 ? (
              <p className="pt-16 text-center text-sm text-slate">No CRs</p>
            ) : (
              <ResponsivePie
                data={approvalPie}
                theme={nivoTheme}
                colors={{ datum: 'data.color' }}
                margin={{ top: 16, right: 16, bottom: 40, left: 16 }}
                innerRadius={0.55}
                padAngle={1.5}
                cornerRadius={3}
                enableArcLabels={false}
                arcLinkLabelsSkipAngle={12}
                arcLinkLabelsTextColor={CHART_COLORS.slate}
                arcLinkLabelsThickness={1}
                arcLinkLabelsColor={{ from: 'color' }}
              />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card px-4 py-4">
          <h3 className="text-sm font-semibold text-ink">Open CR aging</h3>
          <p className="mt-0.5 text-xs text-slate">
            Still-open Change Requests by age
          </p>
          <div className="mt-2 h-64">
            {agingBars.every((b) => b.Open === 0) ? (
              <p className="pt-16 text-center text-sm text-slate">
                No open CRs
              </p>
            ) : (
              <ResponsiveBar
                data={agingBars}
                theme={nivoTheme}
                keys={['Open']}
                indexBy="bucket"
                margin={{ top: 8, right: 16, bottom: 40, left: 48 }}
                padding={0.35}
                colors={[CHART_COLORS.navy]}
                axisBottom={{ tickSize: 0 }}
                axisLeft={{ tickSize: 0 }}
                enableLabel
                labelSkipHeight={12}
                labelTextColor="#fff"
                tooltip={({ indexValue, value, data }) => (
                  <div className="rounded-md bg-navy px-2.5 py-1.5 text-xs text-white shadow">
                    <p className="font-medium">{String(indexValue)}</p>
                    <p>{value} open</p>
                    {commercial && data.valueLabel ? (
                      <p>{formatMoney(String(data.valueLabel), currency)}</p>
                    ) : null}
                  </div>
                )}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/80 bg-card px-4 py-4">
          <h3 className="text-sm font-semibold text-ink">
            {commercial ? 'Person profitability' : 'Hours by person'}
          </h3>
          <p className="mt-0.5 text-xs text-slate">
            Approved time on CRs in range
          </p>
          <div className="mt-2 h-72">
            {personBars.length === 0 ? (
              <p className="pt-20 text-center text-sm text-slate">
                No approved CR time
              </p>
            ) : (
              <ResponsiveBar
                data={personBars}
                theme={nivoTheme}
                keys={commercial ? ['Revenue', 'Cost'] : ['Hours']}
                indexBy="name"
                layout="horizontal"
                groupMode="grouped"
                margin={{ top: 8, right: 24, bottom: 32, left: 100 }}
                padding={0.25}
                colors={
                  commercial
                    ? [CHART_COLORS.coral, CHART_COLORS.navy]
                    : [CHART_COLORS.coral]
                }
                axisBottom={{ tickSize: 0 }}
                axisLeft={{ tickSize: 0 }}
                enableLabel={false}
                legends={
                  commercial
                    ? [
                        {
                          dataFrom: 'keys',
                          anchor: 'bottom',
                          direction: 'row',
                          translateY: 28,
                          itemWidth: 80,
                          itemHeight: 14,
                          symbolSize: 8,
                        },
                      ]
                    : undefined
                }
              />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card px-4 py-4">
          <h3 className="text-sm font-semibold text-ink">
            {commercial
              ? 'Department profitability'
              : 'Hours by department'}
          </h3>
          <p className="mt-0.5 text-xs text-slate">
            Approved time on CRs in range
          </p>
          <div className="mt-2 h-72">
            {deptBars.length === 0 ? (
              <p className="pt-20 text-center text-sm text-slate">
                No approved CR time
              </p>
            ) : (
              <ResponsiveBar
                data={deptBars}
                theme={nivoTheme}
                keys={commercial ? ['Revenue', 'Cost'] : ['Hours']}
                indexBy="name"
                layout="horizontal"
                groupMode="grouped"
                margin={{ top: 8, right: 24, bottom: 32, left: 100 }}
                padding={0.25}
                colors={
                  commercial
                    ? [CHART_COLORS.success, CHART_COLORS.navy]
                    : [CHART_COLORS.navy]
                }
                axisBottom={{ tickSize: 0 }}
                axisLeft={{ tickSize: 0 }}
                enableLabel={false}
                legends={
                  commercial
                    ? [
                        {
                          dataFrom: 'keys',
                          anchor: 'bottom',
                          direction: 'row',
                          translateY: 28,
                          itemWidth: 80,
                          itemHeight: 14,
                          symbolSize: 8,
                        },
                      ]
                    : undefined
                }
              />
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">
            Change Requests
          </h3>
          <p className="text-xs text-slate">
            Opened in range or with approved time in range
            {commercial ? ' — sold value vs cost of hours' : ''}
          </p>
        </div>
        {report.tickets.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate">No CR rows to show.</p>
        ) : (
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-slate">
                <th className="px-4 py-2.5 font-semibold">CR</th>
                <th className="px-3 py-2.5 font-semibold">Client / Project</th>
                <th className="px-3 py-2.5 font-semibold">Approval</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold tabular-nums">Age</th>
                <th className="px-3 py-2.5 font-semibold tabular-nums">Hours</th>
                {commercial ? (
                  <>
                    <th className="px-3 py-2.5 font-semibold tabular-nums">
                      Value
                    </th>
                    <th className="px-3 py-2.5 font-semibold tabular-nums">
                      Cost
                    </th>
                    <th className="px-3 py-2.5 font-semibold tabular-nums">
                      Margin
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Signal</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {report.tickets.map((row) => {
                const signal = marginSignal(row);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 last:border-b-0"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/tickets/${encodeURIComponent(row.reference)}`}
                        className="font-semibold text-coral hover:underline"
                      >
                        {row.reference}
                      </Link>
                      {row.title ? (
                        <p className="mt-0.5 max-w-[14rem] truncate text-xs text-slate">
                          {row.title}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate">
                      <p className="text-ink">{row.clientName}</p>
                      <p className="text-xs">{row.projectName}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      {approvalLabel(row.crApprovalStatus)}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-slate">
                      {row.ticketStatus.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate">
                      {row.ageDays}d
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-ink">
                      {formatHoursMinutes(row.approvedMinutes)}
                    </td>
                    {commercial ? (
                      <>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.crValue != null
                            ? formatMoney(
                                row.crValue,
                                row.crValueCurrency ?? currency,
                              )
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.cost != null
                            ? formatMoney(row.cost, currency)
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.marginVsValue != null
                            ? formatMoney(row.marginVsValue, currency)
                            : '—'}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-xs font-medium ${signal.className}`}
                        >
                          {signal.text}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
