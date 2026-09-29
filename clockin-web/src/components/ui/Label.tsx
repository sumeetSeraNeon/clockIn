import { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...rest }: LabelProps) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-ink', className)}
      {...rest}
    />
  );
}
