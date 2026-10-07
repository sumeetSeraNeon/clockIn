'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

type InfoTipProps = {
  title: string;
  children: ReactNode;
  className?: string;
  /** Prefer panel opening to this side of the button. */
  align?: 'start' | 'end';
};

/**
 * Circular “i” control — hover or keyboard focus opens a compact help panel.
 * Click toggles on touch / pointer devices.
 */
export function InfoTip({
  title,
  children,
  className,
  align = 'start',
}: InfoTipProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const hoverOpen = useRef(false);

  const close = useCallback(() => {
    hoverOpen.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) close();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, close]);

  return (
    <span
      ref={rootRef}
      className={cn('relative inline-flex shrink-0 align-middle', className)}
      onMouseEnter={() => {
        hoverOpen.current = true;
        setOpen(true);
      }}
      onMouseLeave={() => {
        hoverOpen.current = false;
        setOpen(false);
      }}
    >
      <button
        type="button"
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full',
          'border border-navy/20 bg-card text-xs font-semibold text-navy/70',
          'transition hover:border-coral/50 hover:bg-coral-tint/40 hover:text-coral',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40',
          open ? 'border-coral/50 bg-coral-tint/40 text-coral' : null,
        )}
        aria-label={`Help: ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && rootRef.current?.contains(next)) return;
          if (!hoverOpen.current) setOpen(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className={cn(
            'absolute z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-navy/15 bg-card p-3 shadow-md',
            'text-left',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <p className="text-sm font-semibold text-navy">{title}</p>
          <div className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-slate">
            {children}
          </div>
        </div>
      ) : null}
    </span>
  );
}
