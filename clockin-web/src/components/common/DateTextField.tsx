'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/Input';
import { IconCalendar } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

type DateTextFieldProps = {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  disabled?: boolean;
};

/** Display DD/MM/YYYY; store/emit YYYY-MM-DD. */
export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function displayToIso(display: string): string | null {
  const trimmed = display.trim();
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmed);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function DateTextField({
  id,
  value,
  onChange,
  className,
  disabled,
}: DateTextFieldProps) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToDisplay(value));
    setInvalid(false);
  }, [value]);

  function commit() {
    const iso = displayToIso(text);
    if (!iso) {
      setInvalid(true);
      setText(isoToDisplay(value));
      return;
    }
    setInvalid(false);
    if (iso !== value) onChange(iso);
    else setText(isoToDisplay(iso));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  }

  function openPicker() {
    const el = pickerRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  }

  return (
    <div className={cn('inline-flex min-w-[11.5rem] items-stretch', className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        value={text}
        disabled={disabled}
        invalid={invalid}
        onChange={(e) => {
          setText(e.target.value);
          if (invalid) setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 rounded-r-none"
        aria-invalid={invalid}
      />
      <div className="relative shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className={cn(
            'flex h-full items-center justify-center rounded-r-md border border-l-0 border-border bg-card px-2.5 text-slate',
            'hover:bg-muted/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'border-danger',
          )}
          aria-label="Open calendar"
        >
          <IconCalendar className="h-4 w-4" />
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={value}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            setInvalid(false);
            setText(isoToDisplay(next));
            if (next !== value) onChange(next);
          }}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </div>
    </div>
  );
}
