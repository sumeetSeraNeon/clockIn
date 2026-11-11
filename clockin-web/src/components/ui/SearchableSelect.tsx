'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

export type SearchableSelectOption = {
  id: string;
  label: string;
  meta?: string;
};

type SearchableSelectProps = {
  id?: string;
  value: string;
  /** Second arg is the chosen option (null when cleared). */
  onChange: (id: string, option: SearchableSelectOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
  allowClear?: boolean;
  clearLabel?: string;
  selectedLabel?: string | null;
  /** Load full option list once per loadKey (no per-keystroke API). */
  loadOptions: () => Promise<SearchableSelectOption[]>;
  loadKey?: string;
  className?: string;
  invalid?: boolean;
  'aria-label'?: string;
};

/**
 * Simple combobox: fetch once when opened for a loadKey, then filter locally.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search…',
  allowClear = false,
  clearLabel = 'None',
  selectedLabel = null,
  loadOptions,
  loadKey = '',
  className,
  invalid = false,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(loadOptions);
  loadRef.current = loadOptions;

  const cacheRef = useRef<{ key: string; rows: SearchableSelectOption[] } | null>(
    null,
  );
  const requestIdRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allOptions, setAllOptions] = useState<SearchableSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayValue = open
    ? query
    : value
      ? selectedLabel ||
        allOptions.find((o) => o.id === value)?.label ||
        'Selected'
      : '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [allOptions, query]);

  useEffect(() => {
    cacheRef.current = null;
    setAllOptions([]);
    setOpen(false);
    setQuery('');
    setError(null);
    setLoading(false);
  }, [loadKey]);

  useEffect(() => {
    if (!open || disabled || !loadKey) return;

    const cached = cacheRef.current;
    if (cached && cached.key === loadKey) {
      setAllOptions(cached.rows);
      setLoading(false);
      setError(null);
      return;
    }

    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const rows = await loadRef.current();
        if (requestIdRef.current !== reqId) return;
        cacheRef.current = { key: loadKey, rows };
        setAllOptions(rows);
      } catch {
        if (requestIdRef.current !== reqId) return;
        setAllOptions([]);
        setError('Could not load options.');
      } finally {
        if (requestIdRef.current === reqId) setLoading(false);
      }
    })();
  }, [open, disabled, loadKey]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function pick(id: string) {
    if (!id) {
      onChange('', null);
    } else {
      const opt =
        allOptions.find((o) => o.id === id) ??
        filtered.find((o) => o.id === id) ??
        null;
      onChange(id, opt);
    }
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={rootRef} className={cn('relative min-w-0 w-full', className)}>
      <Input
        id={inputId}
        value={displayValue}
        disabled={disabled}
        invalid={invalid}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
        autoComplete="off"
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
      />
      {open && !disabled ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-md"
        >
          {allowClear ? (
            <li>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-2 text-left text-sm text-slate hover:bg-muted/70"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick('')}
              >
                {clearLabel}
              </button>
            </li>
          ) : null}
          {loading ? (
            <li className="px-3 py-2 text-sm text-slate">Loading…</li>
          ) : error ? (
            <li className="px-3 py-2 text-sm text-danger">{error}</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate">No matches</li>
          ) : (
            filtered.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.id === value}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm text-navy hover:bg-muted/70',
                    opt.id === value && 'bg-muted/50 font-medium',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(opt.id)}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
