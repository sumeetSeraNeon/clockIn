/**
 * Freshdesk Excel helpers: UK datetimes and H:MM:SS durations.
 */

/** Parse dd/mm/yy[yy] [H:MM[:SS]] as Europe/London → UTC Date. */
export function parseUkDateTime(
  raw: string | null | undefined,
): Date | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!m) return null;

  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const month = Number(m[2]);
  const day = Number(m[1]);
  const hour = Number(m[4] ?? 0);
  const minute = Number(m[5] ?? 0);
  const second = Number(m[6] ?? 0);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  // Treat wall-clock as Europe/London by correcting UTC guess for DST offset.
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const probe = new Date(asUtc);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(probe)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const hourPart = parts.hour === '24' ? 0 : Number(parts.hour);
  const asLondonMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hourPart,
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asLondonMs - asUtc;
  return new Date(asUtc - offset);
}

/** Parse `0:01:27` or `53:53` into seconds. Empty → null. */
export function parseDurationSeconds(
  raw: string | null | undefined,
): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const parts = s.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (parts.length === 3) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }
  if (parts.length === 2) {
    return parts[0]! * 60 + parts[1]!;
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  return null;
}

/** Normalize Excel contact id to text (avoid 1.12e+12). */
export function contactExternalIdText(
  raw: string | number | null | undefined,
): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return Number.isInteger(raw)
      ? String(raw)
      : raw.toLocaleString('en-GB', { useGrouping: false, maximumFractionDigits: 0 });
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/e\+/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) {
      return n.toLocaleString('en-GB', {
        useGrouping: false,
        maximumFractionDigits: 0,
      });
    }
  }
  return s;
}

export function blankToNull(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  return s ? s : null;
}

export function normalizeInternalAgent(
  raw: string | null | undefined,
): string | null {
  const s = blankToNull(raw);
  if (!s) return null;
  if (s.toLowerCase() === 'no agent') return null;
  return s;
}
