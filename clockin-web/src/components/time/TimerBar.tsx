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
          ? 'rounded-xl border border-coral/20 bg-coral-tint/50 px-4 py-4 sm:px-5 sm:py-5'
          : 'rounded-xl border border-border/50 bg-card/80 px-4 py-4 sm:px-5 sm:py-5'
      }
    >
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
        actions={
          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:pl-1">
            <p
              className={
                running
                  ? 'min-w-[7rem] text-right font-mono text-xl font-medium tabular-nums text-coral sm:text-2xl'
                  : 'min-w-[7rem] text-right font-mono text-xl font-medium tabular-nums text-ink sm:text-2xl'
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
                  className="min-w-[5.5rem]"
                >
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void handleStart()}
                  loading={starting}
                  disabled={busy}
                  className="min-w-[5.5rem]"
                >
                  Start
                </Button>
              )
            ) : null}
          </div>
        }
      />
    </div>
  );
}
