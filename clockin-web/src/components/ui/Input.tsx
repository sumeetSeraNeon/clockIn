import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-md border bg-card px-3.5 py-2.5 text-sm text-ink',
          'outline-none focus:outline-none focus-visible:outline-none',
          'placeholder:text-slate/55',
          invalid
            ? 'border-danger'
            : 'border-border focus:border-border',
          className,
        )}
        {...rest}
      />
    );
  },
);
