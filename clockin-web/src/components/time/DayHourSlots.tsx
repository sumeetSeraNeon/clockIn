'use client';

import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import {
  DAY_MINUTES,
  buildDayHourBuckets,
  busyFromEntries,
  clockFromMinutes,
  formatHoursLabel,
  formatSlotRange,
  freeClickRange,
  mergeBusy,
  slotAxisTickMinutes,
  type BusyInterval,
  type BusyLookup,
  type TimedEntryLike,
} from '@/lib/day-hour-slots';
import { entryTicketInfo } from '@/lib/entry-display';
import type { Project, Task, TimeEntry } from '@/types/api';

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

function HoverMetaRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const text = value?.trim();
  if (!text) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate/80">
        {label}
      </p>
      <p className="truncate text-sm text-ink">{text}</p>
    </div>
  );
}

/**
 * Horizontal 24h bar — flat green free / coral busy; labelled hover card.
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
              'relative h-11 overflow-hidden rounded-md ring-1 ring-success/45',
              onAddRange && !disabled && 'cursor-pointer',
            )}
            onMouseMove={updateHoverFromEvent}
            onMouseLeave={() => setHover(null)}
            onClick={handleTrackClick}
          >
            {/* Twelve 2h cells — stronger zebra free wash, no mid-hour lines */}
            <div className="pointer-events-none absolute inset-0 flex">
              {buckets.map((bucket, i) => (
                <div
                  key={bucket.startMin}
                  className={cn(
                    'relative min-w-0 flex-1',
                    i % 2 === 0 ? 'bg-success/25' : 'bg-success/15',
                    i < buckets.length - 1 && 'border-r-2 border-success/55',
                  )}
                />
              ))}
            </div>

            {/* Busy: true times, full track height, stronger coral */}
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
                  className="pointer-events-none absolute inset-y-0 z-[1] bg-coral/75 ring-1 ring-inset ring-white/70"
                />
              );
            })}

            {/* Hover: full-height flat tint */}
            {hover ? (
              <div
                aria-hidden
                style={{
                  left: `${(hover.startMin / DAY_MINUTES) * 100}%`,
                  width: `${
                    ((hover.endMin - hover.startMin) / DAY_MINUTES) * 100
                  }%`,
                }}
                className={cn(
                  'pointer-events-none absolute inset-y-0 z-[2]',
                  hover.kind === 'busy'
                    ? 'bg-coral/30 ring-1 ring-inset ring-coral/70'
                    : 'bg-success/35 ring-1 ring-inset ring-success/60',
                )}
              />
            ) : null}
          </div>

          {/* Edge ticks on 2h boundaries: 00:00 at left, 02:00 at next edge, … 24:00 at right */}
          <div className="relative h-4 text-[9px] tabular-nums tracking-tight text-slate sm:text-[10px]">
            {slotAxisTickMinutes().map((min, i, ticks) => {
              const isFirst = i === 0;
              const isLast = i === ticks.length - 1;
              const pct = (i / (ticks.length - 1)) * 100;
              return (
                <span
                  key={min}
                  title={
                    i < ticks.length - 1
                      ? formatSlotRange(min, ticks[i + 1]!)
                      : formatSlotRange(ticks[i - 1]!, min)
                  }
                  className={cn(
                    'absolute top-0 whitespace-nowrap',
                    isFirst && 'left-0',
                    isLast && 'right-0',
                    !isFirst && !isLast && '-translate-x-1/2',
                  )}
                  style={
                    !isFirst && !isLast ? { left: `${pct}%` } : undefined
                  }
                >
                  {clockFromMinutes(min)}
                </span>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            'rounded-lg border px-3 py-2.5 transition-colors',
            hover
              ? hover.kind === 'busy'
                ? 'border-coral/50 bg-coral/[0.1]'
                : 'border-success/45 bg-success/[0.1]'
              : 'border-dashed border-border/70 bg-paper/40',
          )}
        >
          {hover ? (
            <div className="space-y-2.5">
              <p className="text-sm font-semibold tabular-nums text-ink">
                {formatSlotRange(hover.startMin, hover.endMin)}
                <span className="ml-2 font-normal text-slate">
                  {formatHoursLabel(hoverMinutes)}
                </span>
              </p>

              {hover.kind === 'busy' ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <HoverMetaRow label="Client" value={hover.clientName} />
                    <HoverMetaRow label="Project" value={hover.projectName} />
                    <HoverMetaRow label="Task" value={hover.taskName} />
                    <HoverMetaRow label="Ticket" value={hover.ticketLabel} />
                  </div>
                  {hover.description?.trim() ? (
                    <p className="text-sm text-slate">{hover.description.trim()}</p>
                  ) : null}
                  {!hover.clientName &&
                  !hover.projectName &&
                  !hover.taskName &&
                  !hover.ticketLabel &&
                  !hover.description?.trim() ? (
                    <p className="text-sm text-slate">Booked</p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate">
                  {disabled || !onAddRange
                    ? 'Available'
                    : 'Available · Click to add time'}
                </p>
              )}
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
