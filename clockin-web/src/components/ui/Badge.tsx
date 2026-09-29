import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'neutral' | 'coral' | 'success' | 'warning' | 'danger';

const variantClass: Record<BadgeVariant, string> = {
  neutral: 'text-slate',
  coral: 'text-coral-dark',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  /** Filled chip — rare; tables use quiet text default. */
  tone?: 'quiet' | 'solid';
};

export function Badge({
  children,
  variant = 'neutral',
  className,
  tone = 'quiet',
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-medium',
        tone === 'solid'
          ? cn(
              'rounded-sm px-1.5 py-0.5',
              variant === 'neutral' && 'bg-navy/5 text-navy',
              variant === 'coral' && 'bg-coral-tint text-coral-dark',
              variant === 'success' && 'bg-success/10 text-success',
              variant === 'warning' && 'bg-warning/10 text-warning',
              variant === 'danger' && 'bg-danger/10 text-danger',
            )
          : variantClass[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
