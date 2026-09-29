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

/** Seven local dates Mon→Sun for the week containing `ref`. */
export function weekDayParams(ref = new Date()): string[] {
  const { from } = weekRange(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return toDateParam(d);
  });
}

/** Normalise API date (ISO or YYYY-MM-DD) to YYYY-MM-DD. */
export function toDateKey(value: string): string {
  return value.slice(0, 10);
}

export function formatWeekLabel(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
  };
  const a = from.toLocaleDateString(undefined, opts);
  const b = to.toLocaleDateString(undefined, opts);
  return `${a} – ${b}`;
}
