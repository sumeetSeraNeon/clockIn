'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { entryStatusLabel } from '@/lib/entry-display';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { Paginated, Task, TimeEntry, TimeLine } from '@/types/api';

type TaskActivityPanelProps = {
  task: Task;
  /** Admin / PM / owner — show Billable / Non-billable on each line. */
  showBillable?: boolean;
  /** When true, show Add time / Start timer CTAs. */
  canStartTimer?: boolean;
};

type TimelineRow = {
  key: string;
  entryDate: string;
  status: string;
  running: boolean;
  minutes: number;
  note: string | null;
  billable: boolean | null;
};

function linesForTask(entry: TimeEntry, taskId: string): TimeLine[] {
  return (entry.timeLines ?? []).filter((line) => line.taskId === taskId);
}

function formatEntryDate(iso: string) {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusBadgeVariant(
  status: string,
  running: boolean,
): 'neutral' | 'coral' | 'success' | 'warning' | 'danger' {
  if (running) return 'coral';
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'submitted') return 'warning';
  return 'neutral';
}

/**
 * Time activity for one task — embedded on the task dashboard Time tab.
 */
export function TaskActivityPanel({
  task,
  showBillable = false,
  canStartTimer = false,
}: TaskActivityPanelProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          taskId: task.id,
          pageSize: '100',
        });
        const res = await api<Paginated<TimeEntry>>(
          `/time-entries?${params.toString()}`,
        );
        if (!cancelled) setEntries(res.data ?? []);
      } catch {
        if (!cancelled) {
          setEntries([]);
          setError('Could not load time for this task.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const rows = useMemo((): TimelineRow[] => {
    const out: TimelineRow[] = [];
    for (const entry of entries) {
      const lines = linesForTask(entry, task.id);
      if (lines.length === 0) continue;
      const running = entry.endTime === null && entry.source === 'timer';
      for (const line of lines) {
        out.push({
          key: `${entry.id}-${line.id}`,
          entryDate: entry.entryDate,
          status: entry.status,
          running,
          minutes: line.durationMinutes ?? 0,
          note: line.description?.trim() || null,
          billable: typeof line.billable === 'boolean' ? line.billable : null,
        });
      }
    }
    return out;
  }, [entries, task.id]);

  const hourBreakdown = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let all = 0;
    for (const row of rows) {
      all += row.minutes;
      if (row.status === 'approved') approved += row.minutes;
      else if (row.status === 'rejected') rejected += row.minutes;
      else pending += row.minutes;
    }
    return { approved, pending, rejected, all };
  }, [rows]);

  function goStart() {
    if (!canStartTimer) return;
    router.push(`/time?taskId=${encodeURIComponent(task.id)}`);
  }

  function goAddTime() {
    if (!canStartTimer) return;
    router.push(`/time?add=1&taskId=${encodeURIComponent(task.id)}`);
  }

  const tiles = [
    {
      id: 'logged',
      label: 'Logged',
      value: hourBreakdown.all,
      hint: 'All time on this task',
    },
    {
      id: 'awaiting',
      label: 'Awaiting approval',
      value: hourBreakdown.pending,
      hint: 'Not signed off yet',
    },
    {
      id: 'approved',
      label: 'Approved',
      value: hourBreakdown.approved,
      hint: showBillable ? 'Counts for billing' : 'Signed off',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">
            Time logged on this task
          </h3>
          <p className="mt-0.5 text-sm text-slate">
            Track work here, then submit it for approval from Timesheet.
          </p>
        </div>
        {canStartTimer ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={goAddTime}>
              Add time
            </Button>
            <Button type="button" onClick={goStart}>
              Start timer
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate">
              {tile.label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-navy">
              {loading ? '…' : formatHoursMinutes(tile.value)}
            </p>
            <p className="mt-0.5 text-xs text-slate">{tile.hint}</p>
          </div>
        ))}
      </div>

      {!loading && hourBreakdown.rejected > 0 ? (
        <p className="text-sm text-danger">
          {formatHoursMinutes(hourBreakdown.rejected)} rejected — fix or
          re-submit from Timesheet.
        </p>
      ) : null}

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-navy">Activity</h4>

        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : loading ? (
          <p className="text-sm text-slate">Loading activity…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-sm text-slate">
            {canStartTimer
              ? 'No time logged yet. Start the timer or add an entry.'
              : 'No time logged on this task yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-navy/10 rounded-lg border border-border/60">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy">
                    {formatEntryDate(row.entryDate)}
                  </p>
                  {row.note ? (
                    <p className="mt-0.5 truncate text-sm text-slate">
                      {row.note}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-slate/70">No note</p>
                  )}
                  {showBillable && row.billable !== null ? (
                    <p className="mt-1 text-xs text-slate">
                      {row.billable ? 'Billable' : 'Non-billable'}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums text-navy">
                    {formatHoursMinutes(row.minutes)}
                  </span>
                  <Badge
                    variant={statusBadgeVariant(row.status, row.running)}
                    tone="solid"
                  >
                    {entryStatusLabel(row.status, row.running)}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
