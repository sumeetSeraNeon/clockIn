'use client';

import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import { currencySymbol } from '@/lib/format-money';

type MoneyAmountFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  hint?: string;
};

/**
 * FIX 3 — plain number input with static currency label (no dropdown).
 */
export function MoneyAmountField({
  id,
  label,
  value,
  onChange,
  currency,
  error,
  disabled,
  placeholder = '0.00',
  required,
  hint,
}: MoneyAmountFieldProps) {
  const symbol = currencySymbol(currency);

  return (
    <FormField
      label={label}
      htmlFor={id}
      error={error}
      hint={hint ?? `Currency: ${currency.toUpperCase()}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 text-sm font-medium tabular-nums text-slate"
          aria-hidden
        >
          {symbol}
        </span>
        <Input
          id={id}
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          invalid={Boolean(error)}
          disabled={disabled}
          required={required}
          className="min-w-0 flex-1"
          aria-label={`${label} in ${currency}`}
        />
      </div>
    </FormField>
  );
}
