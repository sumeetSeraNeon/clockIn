import type { PartialTheme } from '@nivo/theming';

/** ClockIn brand colours for Nivo charts. */
export const CHART_COLORS = {
  coral: '#ff494a',
  navy: '#14142b',
  success: '#1d9e75',
  warning: '#ba7517',
  slate: '#5f5e5a',
  danger: '#c0392b',
  paper: '#f4f4f6',
} as const;

export const CHART_PALETTE = [
  CHART_COLORS.coral,
  CHART_COLORS.navy,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.slate,
  CHART_COLORS.danger,
] as const;

/** Shared Nivo theme aligned with paper/navy UI. */
export const nivoTheme: PartialTheme = {
  background: 'transparent',
  text: {
    fontSize: 11,
    fill: CHART_COLORS.slate,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  axis: {
    domain: {
      line: { stroke: '#e2e1e8', strokeWidth: 1 },
    },
    ticks: {
      line: { stroke: '#e2e1e8', strokeWidth: 1 },
      text: { fill: CHART_COLORS.slate, fontSize: 11 },
    },
    legend: {
      text: { fill: CHART_COLORS.navy, fontSize: 12 },
    },
  },
  grid: {
    line: { stroke: '#e2e1e8', strokeWidth: 1 },
  },
  legends: {
    text: { fill: CHART_COLORS.slate, fontSize: 11 },
  },
  tooltip: {
    container: {
      background: '#ffffff',
      color: CHART_COLORS.navy,
      fontSize: 12,
      borderRadius: 8,
      boxShadow: '0 4px 16px rgba(20, 20, 43, 0.12)',
      border: '1px solid #e2e1e8',
    },
  },
};
