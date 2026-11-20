/**
 * Timesheet wall-clock convention: store HH:mm as UTC components on the entry date.
 * `2026-11-17T09:00:00.000Z` means 09:00 on that date — not a real timezone instant.
 */

const CLOCK_RE = /^(\d{2}):(\d{2})$/;

/** Normalise `HH:mm` (optionally with seconds). */
export function normalizeClock(value: string): string | null {
  const clock = value.includes('T')
    ? clockFromWallIso(value)
    : value.slice(0, 5);
  if (!clock || !CLOCK_RE.test(clock)) return null;
  return clock;
}

/** Build wall ISO: `YYYY-MM-DDTHH:mm:00.000Z`. */
export function wallIsoFromDateAndClock(
  entryDate: string,
  clock: string,
): string {
  const day = entryDate.slice(0, 10);
  const hhmm = normalizeClock(clock) ?? '00:00';
  return `${day}T${hhmm}:00.000Z`;
}

/** Local browser clock-of-day as `HH:mm`. */
export function clockFromLocalDate(now: Date = new Date()): string {
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Wall ISO for “now” on `entryDate` using the browser’s local clock. */
export function wallIsoNowOnDate(
  entryDate: string,
  now: Date = new Date(),
): string {
  return wallIsoFromDateAndClock(entryDate, clockFromLocalDate(now));
}

/** Read HH:mm from wall ISO (UTC components) or plain clock. */
export function clockFromWallIso(value: string): string | null {
  if (!value.includes('T')) {
    const clock = value.slice(0, 5);
    return CLOCK_RE.test(clock) ? clock : null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Minutes from midnight for HH:mm or wall ISO (UTC components). */
export function minutesFromWallClock(value: string): number | null {
  const clock = clockFromWallIso(value);
  if (!clock) return null;
  const m = CLOCK_RE.exec(clock);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** User-facing clock from wall ISO, e.g. `9:00 AM`. */
export function formatWallClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const mins = minutesFromWallClock(iso);
  if (mins == null) return null;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Local Date for calendar UI from wall ISO + entry date
 * (so FullCalendar plots 09:00 wall, not UTC-shifted).
 */
export function wallIsoToLocalDate(
  iso: string,
  entryDate: string,
): Date | null {
  const mins = minutesFromWallClock(iso);
  if (mins == null) return null;
  const [y, m, d] = entryDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60, 0, 0);
}
