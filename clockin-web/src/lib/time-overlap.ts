/** Shared client helpers for time range overlap (FIX 2). */

export function formatClockHm(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd). */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export type TimedEntry = {
  id: string;
  startTime: string | null;
  endTime: string | null;
  status?: string;
};

/**
 * Find an existing closed entry that overlaps [start, end] on the same day.
 * Skips running timers (no end) and rejected entries.
 */
export function findOverlappingEntry(
  entries: TimedEntry[],
  start: Date,
  end: Date,
  excludeId?: string,
): TimedEntry | null {
  for (const entry of entries) {
    if (excludeId && entry.id === excludeId) continue;
    if (entry.status === 'rejected') continue;
    if (!entry.startTime || !entry.endTime) continue;
    const bStart = new Date(entry.startTime);
    const bEnd = new Date(entry.endTime);
    if (rangesOverlap(start, end, bStart, bEnd)) {
      return entry;
    }
  }
  return null;
}

export function overlapErrorMessage(entry: TimedEntry): string {
  if (!entry.startTime || !entry.endTime) {
    return 'overlaps an existing entry';
  }
  return `overlaps an existing entry ${formatClockHm(entry.startTime)}–${formatClockHm(entry.endTime)}`;
}
