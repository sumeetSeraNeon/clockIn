'use client';

import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Accessible name when label is visually short */
  'aria-label'?: string;
};

/**
 * List search control — own-row layout matching Select label + control chrome.
 */
export function SearchField({
  value,
  onChange,
  label = 'Search',
  placeholder = 'Search…',
  className,
  inputClassName,
  'aria-label': ariaLabel,
}: SearchFieldProps) {
  return (
    <label
      className={cn(
        'flex w-full max-w-md flex-col gap-1 text-xs text-slate',
        className,
      )}
    >
      {label}
      <div className="relative">
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel ?? label}
          className={cn(
            // Match Select control height / border
            'rounded-md border-navy/15 bg-transparent px-2.5 py-1.5 text-sm text-navy',
            'focus:border-navy/40',
            value ? 'pr-14' : undefined,
            inputClassName,
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-medium text-slate hover:bg-navy/5 hover:text-navy"
            aria-label="Clear search"
          >
            Clear
          </button>
        ) : null}
      </div>
    </label>
  );
}

/** Case-insensitive substring match (client-side fallback for pages without API q yet). */
export function matchesSearchQuery(
  query: string,
  ...parts: Array<string | null | undefined>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => (p ?? '').toLowerCase().includes(q));
}
