import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-coral text-white hover:bg-coral-dark disabled:bg-coral/60',
  secondary:
    'border border-navy/20 bg-card text-navy hover:bg-navy/[0.04] disabled:opacity-60',
  danger:
    'bg-danger text-white hover:bg-danger/90 disabled:opacity-60',
  ghost: 'text-navy hover:bg-navy/[0.06] disabled:opacity-60',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral',
          variantClass[variant],
          sizeClass[size],
          className,
        )}
        {...rest}
      >
        {loading ? 'Please wait…' : children}
      </button>
    );
  },
);
