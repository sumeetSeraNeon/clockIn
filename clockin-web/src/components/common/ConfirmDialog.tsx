'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/common/Modal';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Plain-language what will happen if they confirm. */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive (delete/archive/remove) — red confirm button. */
  danger?: boolean;
  loading?: boolean;
  /** Optional extra line under the description. */
  footnote?: string;
  /** Extra body content (e.g. rejection reason field). */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * FIX 5 — one reusable confirm dialog for irreversible / hard-to-undo actions.
 * Do not hand-roll per-screen dialogs.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  footnote,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={() => {
        if (!loading) onCancel();
      }}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            disabled={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {footnote || children ? (
        <>
          {footnote ? <p className="text-sm text-slate">{footnote}</p> : null}
          {children}
        </>
      ) : null}
    </Modal>
  );
}
