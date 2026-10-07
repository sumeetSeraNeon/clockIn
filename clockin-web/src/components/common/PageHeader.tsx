import { ReactNode } from 'react';
import { InfoTip } from '@/components/common/InfoTip';
import { cn } from '@/lib/cn';
import { PAGE_HELP, type PageHelpKey } from '@/lib/page-help';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Shows the shared screen Help (i) next to the title. */
  helpKey?: PageHelpKey;
};

/** Standard page title + optional primary action slot (top-right). */
export function PageHeader({
  title,
  description,
  actions,
  className,
  helpKey,
}: PageHeaderProps) {
  const help = helpKey ? PAGE_HELP[helpKey] : null;

  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 border-b border-navy/15 pb-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-navy">
            {title}
          </h1>
          {help ? (
            <InfoTip title={help.title}>
              {help.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </InfoTip>
          ) : null}
        </div>
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
