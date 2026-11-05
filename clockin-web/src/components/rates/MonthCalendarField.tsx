'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from '@/components/ui/icons';
import { cn } from '@/lib/cn';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

type MonthCalendarFieldProps = {
  /** YYYY-MM */
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

function parseMonth(value: string): { year: number; month: number } {
  const [yearText, monthText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const now = new Date();
  return {
    year: Number.isInteger(year) ? year : now.getFullYear(),
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  };
}

function monthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Month filter that opens a year and a 12-month grid.
 * The value is still one YYYY-MM string.
 */
export function MonthCalendarField({
  value,
  onChange,
  label = 'Month',
}: MonthCalendarFieldProps) {
  const { year, month } = parseMonth(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const minYear = thisYear - 5;
  const maxYear = thisYear + 5;

  useEffect(() => {
    if (open) setViewYear(year);
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const display = new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  function choose(nextYear: number, nextMonth: number) {
    if (nextYear < minYear || nextYear > maxYear) return;
    onChange(monthValue(nextYear, nextMonth));
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="relative flex w-44 shrink-0 flex-col gap-1 text-xs text-slate"
    >
      <span id={`${panelId}-label`}>{label}</span>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${panelId}-label`}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center justify-between gap-2 rounded-md border border-navy/15 bg-transparent px-2.5 py-1.5 text-left text-sm text-navy outline-none focus:border-navy/40"
      >
        <span className="truncate">{display}</span>
        <IconCalendar className="h-4 w-4 text-slate" />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose month"
          className="absolute left-0 top-full z-30 mt-1 w-[17rem] rounded-lg border border-navy/10 bg-card p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md p-1 text-navy hover:bg-navy/[0.06] disabled:opacity-30"
              aria-label="Previous year"
              disabled={viewYear <= minYear}
              onClick={() => setViewYear((current) => current - 1)}
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-navy">{viewYear}</span>
            <button
              type="button"
              className="rounded-md p-1 text-navy hover:bg-navy/[0.06] disabled:opacity-30"
              aria-label="Next year"
              disabled={viewYear >= maxYear}
              onClick={() => setViewYear((current) => current + 1)}
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, index) => {
              const monthNumber = index + 1;
              const selected = viewYear === year && monthNumber === month;
              const isCurrent =
                viewYear === thisYear && monthNumber === thisMonth;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => choose(viewYear, monthNumber)}
                  className={cn(
                    'rounded-md px-2 py-2 text-sm',
                    selected
                      ? 'bg-coral font-medium text-white'
                      : 'text-navy hover:bg-coral-tint',
                    !selected && isCurrent
                      ? 'font-medium text-coral ring-1 ring-coral/40'
                      : undefined,
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="mt-2 w-full rounded-md py-1.5 text-xs font-medium text-coral hover:bg-coral-tint"
            onClick={() => choose(thisYear, thisMonth)}
          >
            This month
          </button>
        </div>
      ) : null}
    </div>
  );
}
