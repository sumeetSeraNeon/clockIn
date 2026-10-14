'use client';

import { useEffect, useMemo } from 'react';
import { FormField } from '@/components/common/FormField';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import {
  sortTicketsForPicker,
  ticketOptionLabel,
} from '@/lib/ticket-options';
import { useTickets } from '@/lib/use-tickets';

type TicketOptionalSelectProps = {
  projectId: string;
  value: string;
  onChange: (ticketId: string) => void;
  disabled?: boolean;
  /** Compact label layout for timer bar (no FormField). */
  compact?: boolean;
  id?: string;
  className?: string;
};

/**
 * FIX 1 — optional ticket after Client → Project → Task.
 * Loads tickets for the selected project only; empty/disabled when none.
 */
export function TicketOptionalSelect({
  projectId,
  value,
  onChange,
  disabled = false,
  compact = false,
  id = 'ticket-optional',
  className,
}: TicketOptionalSelectProps) {
  const { data, loading } = useTickets({
    projectId: projectId || 'all',
    pageSize: 100,
    enabled: Boolean(projectId),
  });

  const options = useMemo(() => sortTicketsForPicker(data), [data]);

  useEffect(() => {
    if (!value || loading) return;
    if (!projectId || !options.some((t) => t.id === value)) {
      onChange('');
    }
    // Intentionally omit onChange — parents pass inline setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear stale ticket only
  }, [projectId, options, value, loading]);

  const noProject = !projectId;
  const empty = Boolean(projectId) && !loading && options.length === 0;
  const selectDisabled = disabled || noProject || empty || loading;

  const placeholder = noProject
    ? 'Select a project first'
    : loading
      ? 'Loading tickets…'
      : empty
        ? 'No tickets for this project'
        : 'None';

  const select = (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={selectDisabled}
      className={cn('min-w-0 w-full', className)}
      aria-label="Ticket (optional)"
    >
      <option value="">{placeholder}</option>
      {options.map((t) => (
        <option key={t.id} value={t.id}>
          {ticketOptionLabel(t)}
        </option>
      ))}
    </Select>
  );

  if (compact) {
    return (
      <label className="flex min-w-0 w-full flex-col gap-1 text-xs text-slate sm:flex-1">
        <span>Ticket (optional)</span>
        {select}
      </label>
    );
  }

  return (
    <FormField
      label="Ticket (optional)"
      htmlFor={id}
      hint={
        empty
          ? 'This project has no tickets yet'
          : 'Only tickets for the selected project'
      }
    >
      {select}
    </FormField>
  );
}
