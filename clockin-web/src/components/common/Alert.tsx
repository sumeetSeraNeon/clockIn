import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type AlertVariant = 'error' | 'success' | 'warning' | 'info';

const variantClass: Record<AlertVariant, string> = {
  error: 'bg-coral-tint text-danger',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-paper text-slate',
};

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

export function Alert({
  className,
  variant = 'info',
  role = 'alert',
  ...rest
}: AlertProps) {
  return (
    <div
      role={role}
      className={cn(
        'rounded-[8px] px-3 py-2 text-sm',
        variantClass[variant],
        className,
      )}
      {...rest}
    />
  );
}
