import { cn } from '@/lib/cn';

type SkeletonProps = {
  className?: string;
};

/** Quiet pulse block for loading placeholders (prefer over spinners). */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-[8px] bg-border/80', className)}
      aria-hidden
    />
  );
}

/** Table-ish skeleton used while list data loads. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
