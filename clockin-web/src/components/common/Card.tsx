import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[16px] border border-border/70 bg-card p-8 shadow-[0_1px_0_rgba(26,26,26,0.03)]',
        className,
      )}
      {...rest}
    />
  );
}
