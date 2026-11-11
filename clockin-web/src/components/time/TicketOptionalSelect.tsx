'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  sortTicketsForPicker,
  ticketOptionLabel,
  ticketTypeDisplay,
} from '@/lib/ticket-options';
import type { Paginated, Ticket } from '@/types/api';

type TicketOptionalSelectProps = {
  projectId: string;
  value: string;
  onChange: (ticketId: string) => void;
  disabled?: boolean;
  selectedLabel?: string | null;
  compact?: boolean;
  id?: string;
  className?: string;
};

/**
 * Optional ticket picker — one GET when opened, then local filter.
 */
export function TicketOptionalSelect({
  projectId,
  value,
  onChange,
  disabled = false,
  selectedLabel: selectedLabelProp = null,
  compact = false,
  id = 'ticket-optional',
  className,
}: TicketOptionalSelectProps) {
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [pickedType, setPickedType] = useState<string | null>(null);

  useEffect(() => {
    setPickedLabel(null);
    setPickedType(null);
  }, [projectId]);

  useEffect(() => {
    if (!value) {
      setPickedLabel(null);
      setPickedType(null);
    }
  }, [value]);

  const loadOptions = useCallback(async () => {
    if (!projectId) return [];
    const params = new URLSearchParams({
      projectId,
      pageSize: '100',
    });
    const res = await api<Paginated<Ticket>>(
      `/tickets?${params.toString()}`,
    );
    return sortTicketsForPicker(res.data ?? []).map((t) => ({
      id: t.id,
      label: ticketOptionLabel(t),
      meta: t.ticketType,
    }));
  }, [projectId]);

  const noProject = !projectId;
  const selectDisabled = disabled || noProject;
  const selectedTypeLabel = pickedType
    ? ticketTypeDisplay(pickedType)
    : null;
  const selectedLabel = pickedLabel || selectedLabelProp;

  const select = (
    <SearchableSelect
      id={id}
      value={value}
      onChange={(nextId, option) => {
        if (!nextId) {
          setPickedLabel(null);
          setPickedType(null);
          onChange('');
          return;
        }
        setPickedLabel(option?.label ?? null);
        setPickedType(option?.meta ?? null);
        onChange(nextId);
      }}
      disabled={selectDisabled}
      placeholder={noProject ? 'Select a project first' : 'Search tickets…'}
      allowClear
      clearLabel="None"
      selectedLabel={selectedLabel}
      loadOptions={loadOptions}
      loadKey={projectId || ''}
      className={cn('min-w-0 w-full', className)}
      aria-label="Ticket (optional)"
    />
  );

  if (compact) {
    return (
      <label className="flex min-w-0 w-full flex-col gap-1 text-xs text-slate sm:flex-1">
        <span>Ticket (optional)</span>
        {select}
        {selectedTypeLabel ? (
          <span className="text-[11px] text-slate">
            Type: {selectedTypeLabel}
          </span>
        ) : null}
      </label>
    );
  }

  const hint = noProject
    ? 'Select a project first'
    : selectedTypeLabel
      ? `Type: ${selectedTypeLabel}`
      : 'Filter the list — only this project';

  return (
    <FormField label="Ticket (optional)" htmlFor={id} hint={hint}>
      {select}
    </FormField>
  );
}
