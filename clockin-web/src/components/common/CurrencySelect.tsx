'use client';

import { Select } from '@/components/ui/Select';
import {
  CURRENCY_OPTIONS,
  ensureCurrencyOption,
} from '@/lib/currencies';

type CurrencySelectProps = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

/**
 * STEP 2 — ISO currency dropdown (defaults should come from org currency).
 */
export function CurrencySelect({
  id,
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: CurrencySelectProps) {
  const selected = ensureCurrencyOption(value);
  const known = CURRENCY_OPTIONS.some((c) => c.code === selected);

  return (
    <Select
      id={id}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel ?? 'Currency'}
    >
      {!known ? (
        <option value={selected}>{selected}</option>
      ) : null}
      {CURRENCY_OPTIONS.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </Select>
  );
}
