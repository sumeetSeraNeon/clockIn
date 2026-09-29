import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm text-navy',
          'outline-none focus:outline-none focus-visible:outline-none',
          invalid
            ? 'border-danger'
            : 'border-navy/15 focus:border-navy/40',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
