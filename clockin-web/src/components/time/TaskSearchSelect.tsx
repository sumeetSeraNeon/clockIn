'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import type { Paginated, Task } from '@/types/api';

type TaskSearchSelectProps = {
  projectId: string;
  value: string;
  onChange: (taskId: string) => void;
  disabled?: boolean;
  selectedLabel?: string | null;
  compact?: boolean;
  id?: string;
  className?: string;
  required?: boolean;
};

/**
 * Project-scoped task picker — one GET when opened, then local filter.
 */
export function TaskSearchSelect({
  projectId,
  value,
  onChange,
  disabled = false,
  selectedLabel: selectedLabelProp = null,
  compact = false,
  id = 'task-search',
  className,
  required = true,
}: TaskSearchSelectProps) {
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  useEffect(() => {
    setPickedLabel(null);
  }, [projectId]);

  useEffect(() => {
    if (!value) setPickedLabel(null);
  }, [value]);

  const loadOptions = useCallback(async () => {
    if (!projectId) return [];
    const params = new URLSearchParams({
      projectId,
      pageSize: '100',
      status: 'open',
    });
    const res = await api<Paginated<Task>>(`/tasks?${params.toString()}`);
    return (res.data ?? []).map((t) => ({ id: t.id, label: t.name }));
  }, [projectId]);

  const noProject = !projectId;
  const selectDisabled = disabled || noProject;
  const selectedLabel = pickedLabel || selectedLabelProp;

  const select = (
    <SearchableSelect
      id={id}
      value={value}
      onChange={(nextId, option) => {
        setPickedLabel(option?.label ?? null);
        onChange(nextId);
      }}
      disabled={selectDisabled}
      placeholder={noProject ? 'Select a project first' : 'Search tasks…'}
      selectedLabel={selectedLabel}
      loadOptions={loadOptions}
      loadKey={projectId || ''}
      className={cn('min-w-0 w-full', className)}
      aria-label="Task"
    />
  );

  if (compact) {
    return (
      <label className="flex min-w-0 w-full flex-col gap-1 text-xs text-slate sm:flex-1">
        <span>
          Task
          {required ? (
            <span className="ml-0.5 text-coral" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        {select}
      </label>
    );
  }

  return (
    <FormField label="Task" htmlFor={id} required={required}>
      {select}
    </FormField>
  );
}
