import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/Label';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
  className?: string;
};

/** Label + control + inline error — used by every auth/CRUD form. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('block', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
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
