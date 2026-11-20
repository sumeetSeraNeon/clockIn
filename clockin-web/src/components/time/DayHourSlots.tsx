'use client';

import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import {
  DAY_MINUTES,
  buildDayHourBuckets,
  busyFromEntries,
  clockFromMinutes,
  formatBusyContextLine,
  formatHoursLabel,
  freeClickRange,
  mergeBusy,
  type BusyInterval,
  type BusyLookup,
  type TimedEntryLike,
} from '@/lib/day-hour-slots';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { Project, Task } from '@/types/api';
import { entryTicketInfo } from '@/lib/entry-display';
import type { TimeEntry } from '@/types/api';

export type DayHourSlotsAddRange = {
  entryDate: string;
  startTime: string;
  endTime: string;
};

type DayHourSlotsProps = {
  entryDate: string;
  entries: TimedEntryLike[];
  projectsById?: Map<string, Project>;
  tasks?: Task[];
  disabled?: boolean;
  onAddRange?: (range: DayHourSlotsAddRange) => void;
  className?: string;
};

type HoverInfo = {
  kind: 'busy' | 'free';
  startMin: number;
  endMin: number;
  clientName?: string;
  projectName?: string;
  taskName?: string;
  ticketLabel?: string;
  description?: string;
};

function labelRange(startMin: number, endMin: number): string {
  return `${clockFromMinutes(startMin)}–${clockFromMinutes(endMin)}`;
}

function hoverFromMinute(
  minute: number,
  bookings: BusyInterval[],
  freeSegments: { startMin: number; endMin: number }[],
): HoverInfo | null {
  const busy = bookings.find(
    (b) => minute >= b.startMin && minute < b.endMin,
  );
  if (busy) {
    return {
      kind: 'busy',
      startMin: busy.startMin,
      endMin: busy.endMin,
      clientName: busy.clientName,
      projectName: busy.projectName,
      taskName: busy.taskName ?? busy.label,
      ticketLabel: busy.ticketLabel,
      description: busy.description,
    };
  }
  const free = freeSegments.find(
    (s) => minute >= s.startMin && minute < s.endMin,
  );
  if (free) {
    return {
      kind: 'free',
      startMin: free.startMin,
      endMin: free.endMin,
    };
  }
  return null;
}

/**
 * Horizontal 24h bar — solid busy blocks; details in a 1–2 row hover panel.
 * Hover is resolved from pointer position on the whole track (no segment flicker).
 */
export function DayHourSlots({
  entryDate,
  entries,
  projectsById,
  tasks = [],
  disabled = false,
  onAddRange,
  className,
}: DayHourSlotsProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const lookup = useMemo<BusyLookup>(() => {
    const tasksById = new Map(tasks.map((t) => [t.id, t]));
    return {
      taskName: (taskId) => tasksById.get(taskId)?.name,
      projectName: (projectId) => projectsById?.get(projectId)?.name,
      clientName: (projectId) => {
        const p = projectsById?.get(projectId);
        return p?.client?.name;
      },
      ticketLabel: (entry) => {
        const info = entryTicketInfo(entry as TimeEntry);
        if (!info) return undefined;
        return info.typeLabel
          ? `${info.reference} (${info.typeLabel})`
          : info.reference;
      },
    };
  }, [projectsById, tasks]);

  const bookings = useMemo(
    () => busyFromEntries(entries, entryDate, lookup),
    [entries, entryDate, lookup],
  );

  const buckets = useMemo(
    () => buildDayHourBuckets(mergeBusy(bookings)),
    [bookings],
  );

  const freeSegments = useMemo(() => {
    return buckets.flatMap((b) =>
      b.segments
        .filter((s) => s.kind === 'free')
        .map((s) => ({ startMin: s.startMin, endMin: s.endMin })),
    );
  }, [buckets]);

  const hoverMinutes = hover ? hover.endMin - hover.startMin : 0;
  const hoverContext = hover
    ? formatBusyContextLine({
        clientName: hover.clientName,
        projectName: hover.projectName,
        taskName: hover.taskName,
        ticketLabel: hover.ticketLabel,
      })
    : '';

  function minuteFromEvent(e: MouseEvent<HTMLDivElement>): number | null {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width - 0.001);
    return (x / rect.width) * DAY_MINUTES;
  }

  function updateHoverFromEvent(e: MouseEvent<HTMLDivElement>) {
    const minute = minuteFromEvent(e);
    if (minute == null) return;
    const next = hoverFromMinute(minute, bookings, freeSegments);
    setHover((prev) => {
      if (
        prev &&
        next &&
        prev.kind === next.kind &&
        prev.startMin === next.startMin &&
        prev.endMin === next.endMin
      ) {
        return prev;
      }
      return next;
    });
  }

  function handleTrackClick(e: MouseEvent<HTMLDivElement>) {
    if (!onAddRange || disabled) return;
    const minute = minuteFromEvent(e);
    if (minute == null) return;
    const busy = bookings.some(
      (b) => minute >= b.startMin && minute < b.endMin,
    );
    if (busy) return;
    const free = freeSegments.find(
      (s) => minute >= s.startMin && minute < s.endMin,
    );
    if (!free) return;
    const range = freeClickRange(free.startMin, free.endMin);
    onAddRange({
      entryDate: entryDate.slice(0, 10),
      startTime: range.startTime,
      endTime: range.endTime,
    });
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-card p-4 shadow-sm',
        className,
      )}
    >
      <div className="min-w-0 space-y-3 overflow-x-auto">
        <div className="min-w-[48rem] space-y-2">
          <div
            ref={trackRef}
            className={cn(
              'relative h-10 overflow-hidden rounded-md bg-paper ring-1 ring-border/60',
              onAddRange && !disabled && 'cursor-pointer',
            )}
            onMouseMove={updateHoverFromEvent}
            onMouseLeave={() => setHover(null)}
            onClick={handleTrackClick}
          >
            {/* Bucket guides + merged busy fill for free-gap geometry */}
            <div className="pointer-events-none absolute inset-0 flex">
              {buckets.map((bucket, i) => (
                <div
                  key={bucket.startMin}
                  className={cn(
                    'relative flex min-w-0 flex-1',
                    i < buckets.length - 1 && 'border-r border-border/35',
                  )}
                >
                  {bucket.segments.map((seg) => {
                    if (seg.kind !== 'busy') {
                      return (
                        <div
                          key={`f-${seg.startMin}-${seg.endMin}`}
                          style={{
                            width: `${
                              ((seg.endMin - seg.startMin) /
                                (bucket.endMin - bucket.startMin)) *
                              100
                            }%`,
                          }}
                          className="min-w-0"
                        />
                      );
                    }
                    return (
                      <div
                        key={`m-${seg.startMin}-${seg.endMin}`}
                        style={{
                          width: `${
                            ((seg.endMin - seg.startMin) /
                              (bucket.endMin - bucket.startMin)) *
                            100
                          }%`,
                        }}
                        className="min-w-0 bg-coral/40"
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Per-entry busy overlays (visual only) */}
            {bookings.map((b) => {
              const left = (b.startMin / DAY_MINUTES) * 100;
              const width = ((b.endMin - b.startMin) / DAY_MINUTES) * 100;
              return (
                <div
                  key={`${b.entryId ?? 'x'}-${b.startMin}-${b.endMin}`}
                  aria-hidden
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 0.4)}%`,
                    minWidth: 4,
                  }}
                  className="pointer-events-none absolute inset-y-0 z-[1] bg-coral/85"
                />
              );
            })}
          </div>

          <div className="flex text-[10px] tabular-nums tracking-wide text-slate">
            {buckets.map((bucket) => (
              <div
                key={`lab-${bucket.startMin}`}
                className="min-w-0 flex-1 text-center"
              >
                {clockFromMinutes(bucket.startMin)}
              </div>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'rounded-lg border px-3 py-2.5 transition-colors',
            hover
              ? hover.kind === 'busy'
                ? 'border-coral/30 bg-coral/[0.06]'
                : 'border-border/80 bg-paper/80'
              : 'border-dashed border-border/70 bg-paper/40',
          )}
        >
          {hover ? (
            <div className="space-y-0.5">
              <p className="text-sm font-medium tabular-nums text-ink">
                {labelRange(hover.startMin, hover.endMin)}
                <span className="ml-2 font-normal text-slate">
                  {formatHoursMinutes(hoverMinutes)}
                  <span className="text-slate/80">
                    {' '}
                    ({formatHoursLabel(hoverMinutes)})
                  </span>
                </span>
                {hover.kind === 'free' ? (
                  <span className="ml-2 text-xs font-normal text-slate">
                    {disabled || !onAddRange
                      ? '· Free'
                      : '· Click to add time'}
                  </span>
                ) : null}
              </p>
              {hover.kind === 'busy' ? (
                <p className="truncate text-sm text-slate">
                  {hoverContext || hover.description || 'Booked'}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate">
              Hover a block for time, client, project, task, and ticket
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
