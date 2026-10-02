'use client';

import { useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import {
  entryDurationMinutes,
  formatEntryCalendarTitle,
  isEntryLocked,
} from '@/lib/entry-display';
import type { Project, Task, TimeEntry } from '@/types/api';

export type CalendarView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';

export type CalendarCreateRange = {
  entryDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
};

type TimeCalendarProps = {
  entries: TimeEntry[];
  projectsById: Map<string, Project>;
  tasksById: Map<string, Task>;
  canEdit: boolean;
  /** Used only on first mount — FullCalendar owns date after that. */
  initialView?: CalendarView;
  onDatesSet: (range: { from: string; to: string; view: CalendarView }) => void;
  onSelectCreate: (range: CalendarCreateRange) => void;
  onEventClick: (entry: TimeEntry) => void;
  onEventMove: (
    entry: TimeEntry,
    next: { entryDate: string; startTime: string; endTime: string | null },
  ) => Promise<void>;
};

function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function entryToEvent(
  entry: TimeEntry,
  projectsById: Map<string, Project>,
  tasksById: Map<string, Task>,
): EventInput {
  const first = entry.timeLines?.[0];
  const task = first?.taskId ? tasksById.get(first.taskId) : undefined;
  const project = first?.projectId
    ? projectsById.get(first.projectId)
    : undefined;
  const projectName = task?.project?.name || project?.name;

  const title = formatEntryCalendarTitle(
    entry,
    task?.name,
    projectName,
  );

  let start: Date;
  let end: Date;
  const durationMs = Math.max(entryDurationMinutes(entry), 15) * 60_000;

  if (entry.startTime) {
    start = new Date(entry.startTime);
    end = entry.endTime
      ? new Date(entry.endTime)
      : new Date(start.getTime() + durationMs);
  } else {
    const day = entry.entryDate.slice(0, 10);
    start = new Date(`${day}T09:00:00`);
    end = new Date(start.getTime() + durationMs);
  }

  const locked = isEntryLocked(entry);
  const running = entry.endTime === null && entry.source === 'timer';

  return {
    id: entry.id,
    title,
    start,
    end,
    editable: !locked,
    startEditable: !locked,
    durationEditable: !locked && Boolean(entry.endTime),
    classNames: [
      locked ? 'fc-event-locked' : 'fc-event-open',
      running ? 'fc-event-running' : '',
    ].filter(Boolean),
    backgroundColor: locked ? '#8a8884' : running ? '#ff6b6b' : '#ff494a',
    borderColor: locked ? '#5f5e5a' : running ? '#e03a3b' : '#e03a3b',
    textColor: '#ffffff',
    extendedProps: { entry, locked },
  };
}

/**
 * FIX 3 — date state lives inside FullCalendar after mount.
 * initialDate is always today; parent must not feed datesSet back as initialDate
 * (that remounted on a stale month and broke Today).
 */
export function TimeCalendar({
  entries,
  projectsById,
  tasksById,
  canEdit,
  initialView = 'timeGridDay',
  onDatesSet,
  onSelectCreate,
  onEventClick,
  onEventMove,
}: TimeCalendarProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  // Capture once — never re-apply from parent re-renders.
  const initialViewRef = useRef(initialView);
  const initialDateRef = useRef(new Date());

  const events = useMemo(
    () => entries.map((e) => entryToEvent(e, projectsById, tasksById)),
    [entries, projectsById, tasksById],
  );

  return (
    <div className="clockin-calendar rounded-lg border border-border/80 bg-card px-3 py-3 sm:px-4 sm:py-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialViewRef.current}
        initialDate={initialDateRef.current}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          // FIX 2 — Day first, then Week, then Month
          right: 'timeGridDay,timeGridWeek,dayGridMonth',
        }}
        buttonText={{
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day',
        }}
        height="auto"
        stickyHeaderDates
        nowIndicator
        editable={canEdit}
        selectable={canEdit}
        selectMirror
        selectAllow={(arg) => {
          if (!canEdit) return false;
          const day = toDateParam(arg.start);
          return day <= toDateParam(new Date());
        }}
        eventStartEditable={canEdit}
        eventDurationEditable={canEdit}
        events={events}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        weekends
        datesSet={(arg: DatesSetArg) => {
          const view = arg.view.type as CalendarView;
          // end is exclusive in FullCalendar
          const endInclusive = new Date(arg.end);
          endInclusive.setDate(endInclusive.getDate() - 1);
          onDatesSet({
            from: toDateParam(arg.start),
            to: toDateParam(endInclusive),
            view,
          });
        }}
        select={(arg: DateSelectArg) => {
          if (!canEdit) return;
          let start = arg.start;
          let end = arg.end;
          if (toDateParam(start) > toDateParam(new Date())) {
            arg.view.calendar.unselect();
            return;
          }
          // Month (all-day) select → default 1h block at 09:00 local
          if (arg.allDay) {
            start = new Date(arg.start);
            start.setHours(9, 0, 0, 0);
            end = new Date(start);
            end.setHours(10, 0, 0, 0);
          }
          const durationMinutes = Math.max(
            1,
            Math.round((end.getTime() - start.getTime()) / 60_000),
          );
          onSelectCreate({
            entryDate: toDateParam(start),
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            durationMinutes,
          });
          arg.view.calendar.unselect();
        }}
        eventClick={(arg: EventClickArg) => {
          const entry = arg.event.extendedProps.entry as TimeEntry | undefined;
          if (entry) onEventClick(entry);
        }}
        eventDrop={async (arg: EventDropArg) => {
          const entry = arg.event.extendedProps.entry as TimeEntry | undefined;
          if (!entry || !canEdit || arg.event.extendedProps.locked) {
            arg.revert();
            return;
          }
          const start = arg.event.start;
          const end = arg.event.end;
          if (!start || toDateParam(start) > toDateParam(new Date())) {
            arg.revert();
            return;
          }
          try {
            await onEventMove(entry, {
              entryDate: toDateParam(start),
              startTime: start.toISOString(),
              endTime: end ? end.toISOString() : null,
            });
          } catch {
            arg.revert();
          }
        }}
        eventResize={async (arg: EventResizeDoneArg) => {
          const entry = arg.event.extendedProps.entry as TimeEntry | undefined;
          if (!entry || !canEdit || arg.event.extendedProps.locked) {
            arg.revert();
            return;
          }
          const start = arg.event.start;
          const end = arg.event.end;
          if (!start || !end) {
            arg.revert();
            return;
          }
          try {
            await onEventMove(entry, {
              entryDate: toDateParam(start),
              startTime: start.toISOString(),
              endTime: end.toISOString(),
            });
          } catch {
            arg.revert();
          }
        }}
      />
    </div>
  );
}
