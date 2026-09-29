import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
};

/** Simple prev/next pagination footer for list screens. */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1 && total <= pageSize) {
    return (
      <p className={cn('mt-4 text-sm text-slate', className)}>
        {total} {total === 1 ? 'result' : 'results'}
      </p>
    );
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        'mt-4 flex flex-wrap items-center justify-between gap-3',
        className,
      )}
    >
      <p className="text-sm text-slate">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm tabular-nums text-slate">
          {page} / {totalPages || 1}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
