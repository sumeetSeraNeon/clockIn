import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/Label';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  /** Shows a coral asterisk; mark fields that must be filled to submit. */
  required?: boolean;
  children: ReactNode;
  className?: string;
};

/** Label + control + inline error — used by every auth/CRUD form. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('block', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-coral" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate">{hint}</p>
      ) : null}
    </div>
  );
}
