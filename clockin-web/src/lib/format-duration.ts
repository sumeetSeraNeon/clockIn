/** Format minutes as "12h 30m" (Clockify-style). */
export function formatHoursMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Decimal hours for compact stats, e.g. 12.5 */
export function formatDecimalHours(totalMinutes: number): string {
  return (Math.max(0, totalMinutes) / 60).toFixed(1);
}
