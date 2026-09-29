import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
};

/** Friendly empty list / feature-not-ready state with optional coral CTA. */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[12px] border border-dashed border-border bg-card px-6 py-14 text-center',
        className,
      )}
    >
      <p className="text-base font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-slate">{description}</p>
      ) : null}
      {children}
      {actionLabel && onAction ? (
        <Button type="button" className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
