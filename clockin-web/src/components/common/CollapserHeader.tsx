'use client';

import type { ComponentType } from 'react';
import {
  IconChevronDown,
  IconClients,
  IconProjects,
  IconTasks,
} from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export type CollapserLevel = 'client' | 'project' | 'task';

type IconComp = ComponentType<{ className?: string }>;

const LEVEL_STYLES: Record<
  CollapserLevel,
  {
    Icon: IconComp;
    button: string;
    tile: string;
    title: string;
    hours: string;
  }
> = {
  client: {
    Icon: IconClients,
    button:
      'border-l-4 border-navy bg-navy/[0.07] px-4 py-3.5 hover:bg-navy/[0.1] sm:px-5',
    tile: 'bg-navy/10 text-navy',
    title: 'text-lg font-semibold tracking-tight text-navy',
    hours: 'text-sm font-semibold text-navy',
  },
  project: {
    Icon: IconProjects,
    button:
      'border-l-4 border-slate/40 bg-paper/80 px-4 py-3 pl-5 hover:bg-paper sm:px-5 sm:pl-7',
    tile: 'bg-card text-slate ring-1 ring-border/60',
    title: 'text-base font-medium tracking-tight text-ink',
    hours: 'text-sm font-medium text-ink',
  },
  task: {
    Icon: IconTasks,
    button:
      'border-l-4 border-coral/50 bg-card/40 px-4 py-3 pl-5 hover:bg-coral-tint/30 sm:px-5 sm:pl-8',
    tile: 'bg-coral-tint text-coral',
    title: 'text-base font-semibold tracking-tight text-navy',
    hours: 'text-sm font-semibold text-navy',
  },
};

type CollapserHeaderProps = {
  level: CollapserLevel;
  open: boolean;
  title: string;
  hoursLabel: string;
  hoursSubLabel?: string;
  onToggle: () => void;
};

/** Shared Client / Project / Task expand chrome (Timesheet + Approvals). */
export function CollapserHeader({
  level,
  open,
  title,
  hoursLabel,
  hoursSubLabel,
  onToggle,
}: CollapserHeaderProps) {
  const style = LEVEL_STYLES[level];
  const Icon = style.Icon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center justify-between gap-3 text-left transition',
        style.button,
      )}
      aria-expanded={open}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            style.tile,
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className={cn('truncate', style.title)}>{title}</p>
          {hoursSubLabel ? (
            <p className="mt-0.5 truncate text-xs text-slate sm:hidden">
              {hoursSubLabel}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="text-right">
          <p className={cn('tabular-nums', style.hours)}>{hoursLabel}</p>
          {hoursSubLabel ? (
            <p className="hidden text-xs text-slate sm:block">{hoursSubLabel}</p>
          ) : null}
        </div>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate transition-colors hover:bg-navy/5"
          aria-hidden
        >
          <IconChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              open ? 'rotate-180' : 'rotate-0',
            )}
          />
        </span>
      </div>
    </button>
  );
}
