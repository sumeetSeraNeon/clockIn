'use client';

import { useEffect, useState } from 'react';
import { TimerBarFields } from '@/components/time/TimeLineForm';
import { Button } from '@/components/ui/Button';
import { formatElapsed } from '@/lib/format-elapsed';
import type { Project, Task, TimeEntry } from '@/types/api';

type TimerBarProps = {
  running: TimeEntry | null;
  tasks: Task[];
  projects: Project[];
  canEdit: boolean;
  /** FINAL FIX 3 — members never see billable */
  showBillable?: boolean;
  /** Tasks → Track: select this task on the idle timer */
  preselectTaskId?: string | null;
  onPreselectConsumed?: () => void;
  starting: boolean;
  stopping: boolean;
  onStart: (values: {
    description: string;
    taskId: string;
  }) => Promise<void>;
  onStop: () => Promise<void>;
};

export function TimerBar({
  running,
  tasks,
  projects,
  canEdit,
  showBillable = false,
  preselectTaskId = null,
  onPreselectConsumed,
  starting,
  stopping,
  onStart,
  onStop,
}: TimerBarProps) {
  const [description, setDescription] = useState('');
  const [taskId, setTaskId] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!preselectTaskId || running) return;
    const match = tasks.find((t) => t.id === preselectTaskId);
    if (!match) return;
    setTaskId(match.id);
    setDescription((prev) => prev || match.name);
    onPreselectConsumed?.();
  }, [preselectTaskId, tasks, running, onPreselectConsumed]);

  useEffect(() => {
    if (!running?.startTime) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running?.startTime, running?.id]);

  useEffect(() => {
    if (running) {
      const line = running.timeLines?.[0];
      setDescription(line?.description ?? '');
      setTaskId(line?.taskId ?? '');
    }
  }, [running]);

  const elapsedSeconds = running?.startTime
    ? Math.max(
        0,
        Math.floor((now - new Date(running.startTime).getTime()) / 1000),
      )
    : 0;

  const busy = starting || stopping;

  async function handleStart() {
    await onStart({ description, taskId });
  }

  return (
    <div
      className={
        running
          ? 'rounded-lg border border-coral/25 bg-coral-tint/60 px-4 py-4 sm:px-5'
          : 'rounded-lg border border-border/80 bg-card px-4 py-4 sm:px-5'
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <TimerBarFields
          description={description}
          onDescriptionChange={setDescription}
          taskId={taskId}
          onTaskChange={setTaskId}
          tasks={tasks}
          projects={projects}
          disabled={!canEdit || Boolean(running) || busy}
          showBillable={showBillable}
          storedBillable={
            running ? (running.timeLines?.[0]?.billable ?? null) : null
          }
        />

        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <p
            className={
              running
                ? 'min-w-[7.5rem] text-right font-mono text-2xl font-medium tabular-nums text-coral'
                : 'min-w-[7.5rem] text-right font-mono text-2xl font-medium tabular-nums text-ink'
            }
          >
            {formatElapsed(elapsedSeconds)}
          </p>

          {canEdit ? (
            running ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onStop()}
                loading={stopping}
                disabled={busy}
                className="min-w-[6.5rem]"
              >
                Stop
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleStart()}
                loading={starting}
                disabled={busy}
                className="min-w-[6.5rem]"
              >
                Start
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
