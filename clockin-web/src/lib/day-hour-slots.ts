import { minutesFromWallClock } from '@/lib/wall-clock';

/** Minutes from midnight for HH:mm or wall ISO (UTC clock components). */
export function minutesFromClock(value: string): number | null {
  return minutesFromWallClock(value);
}

export function clockFromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(total)));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  // 24:00 → show as 24:00 only at end-of-day boundary for labels
  if (clamped === 24 * 60) return '24:00';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** UI-only 24h range for day-slot hover, e.g. `00:00–01:00`. */
export function formatSlotRange(startMin: number, endMin: number): string {
  return `${clockFromMinutes(startMin)}–${clockFromMinutes(endMin)}`;
}

/** 1h boundary ticks for the axis: 00:00, 01:00, … 24:00 (25 marks). */
export function slotAxisTickMinutes(): number[] {
  const ticks: number[] = [];
  for (let m = 0; m <= DAY_MINUTES; m += SLOT_MINUTES) {
    ticks.push(m);
  }
  return ticks;
}

export type BusyInterval = {
  startMin: number;
  endMin: number;
  entryId?: string;
  /** @deprecated Prefer taskName — kept for older call sites. */
  label?: string;
  description?: string;
  clientName?: string;
  projectName?: string;
  taskName?: string;
  ticketLabel?: string;
};

export type SlotSegment = {
  startMin: number;
  endMin: number;
  kind: 'busy' | 'free';
  entryId?: string;
  label?: string;
  description?: string;
  clientName?: string;
  projectName?: string;
  taskName?: string;
  ticketLabel?: string;
};

export type DayHourBucket = {
  /** Bucket start minute (0, 60, …) */
  startMin: number;
  endMin: number;
  segments: SlotSegment[];
};

export const SLOT_MINUTES = 60;
export const DAY_MINUTES = 24 * 60;
export const BASE_BUCKET_COUNT = 24;

export function baseBuckets(): { startMin: number; endMin: number }[] {
  const out: { startMin: number; endMin: number }[] = [];
  for (let i = 0; i < BASE_BUCKET_COUNT; i++) {
    const startMin = i * SLOT_MINUTES;
    out.push({ startMin, endMin: startMin + SLOT_MINUTES });
  }
  return out;
}

/** Merge overlapping/adjacent busy intervals (sorted). */
export function mergeBusy(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMin - b.startMin);
  const merged: BusyInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.startMin <= last.endMin) {
      if (cur.endMin > last.endMin) {
        last.endMin = cur.endMin;
        if (!last.label && cur.label) last.label = cur.label;
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/** Prefill duration when clicking a free segment (1h within the free remnant). */
export const CLICK_PREFILL_MINUTES = 60;

/**
 * Prefill range when clicking a free segment: remnant capped at 1 hour.
 * End-of-day uses 23:59 (input type=time cannot be 24:00).
 */
export function freeClickRange(
  segStart: number,
  segEnd: number,
): { startTime: string; endTime: string } {
  const startMin = Math.max(0, Math.min(DAY_MINUTES - 1, segStart));
  let endMin = Math.min(segEnd, segStart + CLICK_PREFILL_MINUTES);
  if (endMin <= startMin) {
    endMin = Math.min(DAY_MINUTES - 1, startMin + 1);
  }
  if (endMin >= DAY_MINUTES) {
    endMin = DAY_MINUTES - 1;
  }
  return {
    startTime: clockFromMinutes(startMin),
    endTime: clockFromMinutes(endMin),
  };
}

/**
 * Split each 1h bucket into free/busy segments from day's busy intervals.
 */
export function buildDayHourBuckets(
  busy: BusyInterval[],
): DayHourBucket[] {
  const merged = mergeBusy(
    busy
      .map((b) => ({
        ...b,
        startMin: Math.max(0, b.startMin),
        endMin: Math.min(DAY_MINUTES, b.endMin),
      }))
      .filter((b) => b.endMin > b.startMin),
  );

  return baseBuckets().map((bucket) => {
    const segments: SlotSegment[] = [];
    let cursor = bucket.startMin;

    const overlapping = merged.filter(
      (b) => b.startMin < bucket.endMin && b.endMin > bucket.startMin,
    );

    for (const b of overlapping) {
      const segStart = Math.max(bucket.startMin, b.startMin);
      const segEnd = Math.min(bucket.endMin, b.endMin);
      if (segStart > cursor) {
        segments.push({
          startMin: cursor,
          endMin: segStart,
          kind: 'free',
        });
      }
      if (segEnd > segStart) {
        segments.push({
          startMin: segStart,
          endMin: segEnd,
          kind: 'busy',
          entryId: b.entryId,
          label: b.label ?? b.taskName,
          description: b.description,
          clientName: b.clientName,
          projectName: b.projectName,
          taskName: b.taskName,
          ticketLabel: b.ticketLabel,
        });
        cursor = segEnd;
      }
    }

    if (cursor < bucket.endMin) {
      segments.push({
        startMin: cursor,
        endMin: bucket.endMin,
        kind: 'free',
      });
    }

    if (segments.length === 0) {
      segments.push({
        startMin: bucket.startMin,
        endMin: bucket.endMin,
        kind: 'free',
      });
    }

    return {
      startMin: bucket.startMin,
      endMin: bucket.endMin,
      segments,
    };
  });
}

export type TimedEntryLike = {
  id: string;
  entryDate: string;
  startTime?: string | null;
  endTime?: string | null;
  timeLines?: Array<{
    durationMinutes?: number | null;
    taskId?: string | null;
    projectId?: string | null;
    clientId?: string | null;
    task?: { name?: string | null } | null;
    description?: string | null;
    ticket?: { reference?: string | null; ticketType?: string | null } | null;
    ticketType?: string | null;
  }>;
};

export type BusyLookup = {
  taskName?: (taskId: string) => string | undefined;
  projectName?: (projectId: string) => string | undefined;
  clientName?: (projectId: string, clientId?: string | null) => string | undefined;
  ticketLabel?: (entry: TimedEntryLike) => string | undefined;
};

/** Busy intervals for one calendar day from timed entries (per entry, not merged). */
export function busyFromEntries(
  entries: TimedEntryLike[],
  day: string,
  lookup?: BusyLookup,
): BusyInterval[] {
  const dayKey = day.slice(0, 10);
  const out: BusyInterval[] = [];
  for (const e of entries) {
    if (e.entryDate.slice(0, 10) !== dayKey) continue;
    if (!e.startTime || !e.endTime) continue;
    const startMin = minutesFromClock(e.startTime);
    const endMin = minutesFromClock(e.endTime);
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    const line = e.timeLines?.[0];
    const taskId = line?.taskId ?? undefined;
    const projectId = line?.projectId ?? undefined;
    const taskName =
      (taskId ? lookup?.taskName?.(taskId) : undefined) ||
      line?.task?.name?.trim() ||
      undefined;
    const projectName = projectId
      ? lookup?.projectName?.(projectId)
      : undefined;
    const clientName = projectId
      ? lookup?.clientName?.(projectId, line?.clientId)
      : undefined;
    const ticketLabel = lookup?.ticketLabel?.(e);
    const description = line?.description?.trim() || undefined;
    out.push({
      startMin,
      endMin,
      entryId: e.id,
      label: taskName,
      taskName,
      projectName,
      clientName,
      ticketLabel,
      description,
    });
  }
  return out;
}

/** Compact “Client · Project · Task · Ticket” line. */
export function formatBusyContextLine(b: {
  clientName?: string;
  projectName?: string;
  taskName?: string;
  label?: string;
  ticketLabel?: string;
}): string {
  return [
    b.clientName,
    b.projectName,
    b.taskName ?? b.label,
    b.ticketLabel,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * Suggest next 1h range after the last booking end that day.
 * Empty day → current local hour floored (or 0 if `now` not given).
 */
export function suggestNextRange(
  entries: TimedEntryLike[],
  day: string,
  now: Date = new Date(),
): { startTime: string; endTime: string } {
  const busy = mergeBusy(busyFromEntries(entries, day));
  let startMin: number;
  if (busy.length > 0) {
    startMin = busy[busy.length - 1].endMin;
  } else {
    startMin = now.getHours() * 60;
  }
  if (startMin >= DAY_MINUTES - 60) {
    startMin = Math.max(0, DAY_MINUTES - 60);
  }
  const endMin = Math.min(DAY_MINUTES - 1, startMin + 60);
  return {
    startTime: clockFromMinutes(startMin),
    endTime: clockFromMinutes(endMin),
  };
}

export function formatHoursLabel(minutes: number): string {
  const h = minutes / 60;
  if (Number.isInteger(h)) return `${h}h`;
  return `${h.toFixed(1).replace(/\.0$/, '')}h`;
}
