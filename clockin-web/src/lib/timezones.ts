/** Common IANA zones for personal Settings (FIX 1). */
export const COMMON_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
] as const;

export function ensureTimezoneOption(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  if ((COMMON_TIMEZONES as readonly string[]).includes(v)) return v;
  return v;
}
