import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/** Standard page title + optional primary action slot (top-right). */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 border-b border-navy/15 pb-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 sm:self-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
