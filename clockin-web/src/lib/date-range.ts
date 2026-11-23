/** Local calendar date as YYYY-MM-DD for report query params. */
export function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday 00:00 → Sunday of the week containing `ref`. */
export function weekRange(ref = new Date()): { from: Date; to: Date } {
  const day = ref.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const from = new Date(ref);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + mondayOffset);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** First → last day of the calendar month containing `ref`. */
export function monthRange(ref = new Date()): { from: Date; to: Date } {
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** Parse YYYY-MM-DD as a local calendar date (noon to avoid DST edges). */
export function parseDateParam(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

/** Seven local dates Mon→Sun for the week containing `ref`. */
export function weekDayParams(ref = new Date()): string[] {
  const { from } = weekRange(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return toDateParam(d);
  });
}

/** Inclusive YYYY-MM-DD list from `from` through `to` (local). */
export function dateParamsInRange(from: string, to: string): string[] {
  const start = parseDateParam(from.slice(0, 10));
  const end = parseDateParam(to.slice(0, 10));
  if (end < start) return [];
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(toDateParam(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** `YYYY-MM` from a YYYY-MM-DD (or longer ISO) string. */
export function yearMonthFromDateParam(day: string): string {
  return day.slice(0, 7);
}

/** Distinct calendar months (`YYYY-MM`) spanned by an inclusive date range. */
export function yearMonthsInRange(from: string, to: string): string[] {
  const days = dateParamsInRange(from, to);
  const months: string[] = [];
  for (const d of days) {
    const ym = yearMonthFromDateParam(d);
    if (months[months.length - 1] !== ym) months.push(ym);
  }
  return months;
}

/** Keep only days whose month matches `yearMonth` (`YYYY-MM`). */
export function dateParamsInYearMonth(
  days: string[],
  yearMonth: string,
): string[] {
  const ym = yearMonth.slice(0, 7);
  return days.filter((d) => yearMonthFromDateParam(d) === ym);
}

/** Previous/next month within `months`, or null at the edge. */
export function adjacentYearMonth(
  months: string[],
  current: string,
  delta: -1 | 1,
): string | null {
  const ym = current.slice(0, 7);
  const i = months.indexOf(ym);
  if (i < 0) return months[0] ?? null;
  return months[i + delta] ?? null;
}

/** Normalise API date (ISO or YYYY-MM-DD) to YYYY-MM-DD. */
export function toDateKey(value: string): string {
  return value.slice(0, 10);
}

export function formatWeekLabel(from: Date, to: Date): string {
  return formatDisplayDateRange(toDateParam(from), toDateParam(to));
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** User-facing label: `04-Nov-2026` from YYYY-MM-DD or Date. */
export function formatDisplayDate(value: string | Date): string {
  const key =
    typeof value === 'string' ? value.slice(0, 10) : toDateParam(value);
  const d = parseDateParam(key);
  const y = d.getFullYear();
  const mon = MONTH_SHORT[d.getMonth()] ?? 'Jan';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${mon}-${y}`;
}

/** Single day or `04-Nov-2026 – 19-Nov-2026`. */
export function formatDisplayDateRange(
  from: string | Date,
  to?: string | Date | null,
): string {
  const a = formatDisplayDate(from);
  if (to == null) return a;
  const fromKey =
    typeof from === 'string' ? from.slice(0, 10) : toDateParam(from);
  const toKey = typeof to === 'string' ? to.slice(0, 10) : toDateParam(to);
  if (fromKey === toKey) return a;
  return `${a} – ${formatDisplayDate(to)}`;
}

/** Weekday short label for a YYYY-MM-DD (local), e.g. Mon. */
export function weekdayShort(value: string): string {
  return parseDateParam(value.slice(0, 10)).toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

/** User-facing month label from `YYYY-MM` → `Nov-2026`. */
export function formatDisplayYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.slice(0, 7).split('-');
  const mon = MONTH_SHORT[Number(m) - 1] ?? m;
  return `${mon}-${y}`;
}
