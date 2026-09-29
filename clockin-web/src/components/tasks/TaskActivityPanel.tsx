'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { formatHoursMinutes } from '@/lib/format-duration';
import type { Paginated, Task, TimeEntry, TimeLine } from '@/types/api';

type TaskActivityPanelProps = {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  /** Admin / PM / owner — show Billable / Non-billable on each line. */
  showBillable?: boolean;
  /** True only when caller may start/add time and is the task assignee. */
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

function statusLabel(status: string, running: boolean) {
  if (running) return 'Running';
  return status.replace(/_/g, ' ');
}

/**
 * Track → activity timeline for one task.
 * Start timer / Add time only when the viewer is the assignee.
 */
export function TaskActivityPanel({
  task,
  open,
  onClose,
  showBillable = false,
  canStartTimer = false,
}: TaskActivityPanelProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !task) {
      setEntries([]);
      setError(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          taskId: task!.id,
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
  }, [open, task]);

  const rows = useMemo((): TimelineRow[] => {
    if (!task) return [];
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
  }, [entries, task]);

  const hourBreakdown = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let all = 0;
    for (const row of rows) {
      all += row.minutes;
      if (row.status === 'approved') approved += row.minutes;
      else if (row.status === 'rejected') rejected += row.minutes;
      else pending += row.minutes; // draft + submitted (+ running)
    }
    return { approved, pending, rejected, all };
  }, [rows]);

  const projectName = task?.project?.name;
  const manager =
    task?.project?.owner?.user?.name ||
    task?.project?.owner?.user?.email ||
    null;

  function goStart() {
    if (!task || !canStartTimer) return;
    onClose();
    router.push(`/time?taskId=${encodeURIComponent(task.id)}`);
  }

  function goAddTime() {
    if (!task || !canStartTimer) return;
    onClose();
    router.push(`/time?add=1&taskId=${encodeURIComponent(task.id)}`);
  }

  return (
    <Modal
      open={open && Boolean(task)}
      title={task?.name ?? 'Task activity'}
      description={
        [projectName, manager ? `Manager: ${manager}` : null]
          .filter(Boolean)
          .join(' · ') || 'Time logged against this task.'
      }
      onClose={onClose}
      className="max-w-xl"
      footer={
        canStartTimer ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button type="button" variant="secondary" onClick={goAddTime}>
              Add time
            </Button>
            <Button type="button" onClick={goStart}>
              Start timer
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="border-b border-navy/10 pb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate">
            Approved
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">
            {loading ? '…' : formatHoursMinutes(hourBreakdown.approved)}
          </p>
          <p className="mt-0.5 text-xs text-slate">
            {rows.length} line{rows.length === 1 ? '' : 's'} · approved time
            drives revenue
          </p>
          {!loading && rows.length > 0 ? (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-slate">Pending</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatHoursMinutes(hourBreakdown.pending)}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Rejected</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatHoursMinutes(hourBreakdown.rejected)}
                </dd>
              </div>
              <div>
                <dt className="text-slate">All logged</dt>
                <dd className="mt-0.5 tabular-nums text-navy">
                  {formatHoursMinutes(hourBreakdown.all)}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : loading ? (
          <p className="text-sm text-slate">Loading activity…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate">
            {canStartTimer
              ? 'No time logged on this task yet. Start the timer or add an entry.'
              : 'No time logged on this task yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-navy/10">
            {rows.map((row) => (
              <li key={row.key} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium text-navy">
                    {formatEntryDate(row.entryDate)}
                  </span>
                  <span className="text-slate" aria-hidden>
                    ·
                  </span>
                  <span className="tabular-nums text-navy">
                    {formatHoursMinutes(row.minutes)}
                  </span>
                  <span className="text-slate" aria-hidden>
                    ·
                  </span>
                  <span
                    className={
                      row.running ? 'font-medium text-coral' : 'text-slate'
                    }
                  >
                    {statusLabel(row.status, row.running)}
                  </span>
                  {showBillable && row.billable !== null ? (
                    <>
                      <span className="text-slate" aria-hidden>
                        ·
                      </span>
                      <span className="text-slate">
                        {row.billable ? 'Billable' : 'Non-billable'}
                      </span>
                    </>
                  ) : null}
                </div>
                {row.note ? (
                  <p className="mt-1 truncate text-sm text-slate">{row.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
