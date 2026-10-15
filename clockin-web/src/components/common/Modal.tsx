'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ModalSize = 'md' | 'lg' | 'xl' | '2xl';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** md = forms; lg = clients; xl = projects; 2xl = tasks import. */
  size?: ModalSize;
};

const sizeClass: Record<ModalSize, string> = {
  md: 'w-full max-w-lg',
  lg: 'w-full max-w-xl',
  xl: 'w-full max-w-4xl',
  /** Tasks need Status + Client + Project + Task + two link columns. */
  '2xl': 'w-full max-w-6xl',
};

/** Quiet centered modal for create/edit forms. */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const descriptionId = description ? 'modal-description' : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={descriptionId}
        className={cn(
          'relative z-10 flex max-h-[90vh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-[0_16px_48px_rgba(26,26,26,0.12)] sm:rounded-2xl',
          sizeClass[size],
          className,
        )}
      >
        <div className="shrink-0 border-b border-border/70 px-6 py-5">
          <h2
            id="modal-title"
            className="text-lg font-semibold tracking-tight text-ink"
          >
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-slate">
              {description}
            </p>
          ) : null}
        </div>
        {children ? (
          <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
        ) : null}
        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border/70 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
