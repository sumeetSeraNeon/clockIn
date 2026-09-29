'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  push: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClass: Record<ToastVariant, string> = {
  success: 'border-success/30 bg-card text-success',
  error: 'border-danger/30 bg-card text-danger',
  warning: 'border-warning/30 bg-card text-warning',
  info: 'border-border bg-card text-ink',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto rounded-[8px] border px-4 py-3 text-sm shadow-sm',
              variantClass[toast.variant],
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
