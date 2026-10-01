'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconTime } from '@/components/ui/icons';
import { Skeleton } from '@/components/common/Skeleton';
import { Stat } from '@/app/(app)/dashboard/Stat';
import { api, ApiError } from '@/lib/api-client';
import { formatHoursMinutes } from '@/lib/format-duration';
import { useAuth } from '@/lib/auth-context';
import type { Paginated, Task, TimeEntry } from '@/types/api';

type EmployeeOverviewProps = {
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  todayParam: string;
  daysElapsed: number;
};

function sumDurationMinutes(entries: TimeEntry[]) {
  let durationMinutes = 0;
  for (const entry of entries) {
    for (const line of entry.timeLines ?? []) {
      durationMinutes += line.durationMinutes ?? 0;
    }
  }
  return durationMinutes;
}

/**
 * Personal member dashboard only:
 * period tracked hours (total, today, daily average) + open assigned tasks.
 * No billable, revenue, rates, or org breakdown.
 */
export function EmployeeOverview({
  periodLabel,
  dateFrom,
  dateTo,
  todayParam,
  daysElapsed,
}: EmployeeOverviewProps) {
  const { me } = useAuth();
  const membershipId = me?.membership?.id;

  const [periodEntries, setPeriodEntries] = useState<TimeEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const periodParams = new URLSearchParams({
          dateFrom,
          dateTo,
          pageSize: '100',
        });
        const todayParams = new URLSearchParams({
          dateFrom: todayParam,
          dateTo: todayParam,
          pageSize: '100',
        });

        const [periodRes, todayRes] = await Promise.all([
          api<Paginated<TimeEntry>>(`/time-entries?${periodParams}`),
          api<Paginated<TimeEntry>>(`/time-entries?${todayParams}`),
        ]);

        let openTasks: Task[] = [];
        if (membershipId) {
          try {
            const tasksRes = await api<Paginated<Task>>(
              `/tasks?${new URLSearchParams({
                status: 'open',
                assigneeId: membershipId,
                pageSize: '20',
              })}`,
            );
            openTasks = (tasksRes.data ?? []).filter(
              (t) => t.assigneeId === membershipId,
            );
          } catch {
            openTasks = [];
          }
        }

        if (!cancelled) {
          setPeriodEntries(periodRes.data ?? []);
          setTodayEntries(todayRes.data ?? []);
          setTasks(openTasks);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Could not load your overview.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, todayParam, membershipId]);

  const periodMinutes = sumDurationMinutes(periodEntries);
  const todayMinutes = sumDurationMinutes(todayEntries);
  const hasTime = periodMinutes > 0;
  const avgPerDay = Math.round(periodMinutes / daysElapsed);

  if (loading) {
    return (
      <div className="mt-10 space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <section className="mt-10 rounded-lg border border-border/80 bg-card px-5 py-6">
        <p className="text-sm font-medium text-danger">{error}</p>
        <p className="mt-1 text-sm text-slate">
          Make sure the API is running, then refresh.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-10 space-y-5">
      <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-navy">
              My time
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-navy">
              Your hours
            </h2>
          </div>
          <p className="text-sm text-slate">{periodLabel}</p>
        </div>

        <div className="mt-7 grid gap-8 sm:grid-cols-3">
          <Stat
            label="Tracked this period"
            value={formatHoursMinutes(periodMinutes)}
            accent
          />
          <Stat label="Today" value={formatHoursMinutes(todayMinutes)} />
          <Stat
            label="Daily average"
            value={formatHoursMinutes(avgPerDay)}
            hint={`${daysElapsed} day${daysElapsed === 1 ? '' : 's'} so far`}
          />
        </div>

        {!hasTime ? (
          <div className="mt-10 flex flex-col items-center border-t border-border/70 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-coral-tint text-coral">
              <IconTime className="h-5 w-5" />
            </div>
            <p className="mt-4 text-base font-semibold tracking-tight text-navy">
              No time logged yet
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate">
              Start tracking from the time tracker. Your hours for {periodLabel}{' '}
              will show up here.
            </p>
            <Link
              href="/time"
              className="mt-5 inline-flex text-sm font-medium text-coral transition hover:text-coral-dark"
            >
              Go to time tracker →
            </Link>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border/80 bg-card px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-navy">
              Open tasks
            </h2>
            <p className="mt-1 text-sm text-slate">
              Assigned to you · {tasks.length} open
            </p>
          </div>
          <Link
            href="/tasks"
            className="text-sm font-medium text-slate transition hover:text-coral"
          >
            All tasks →
          </Link>
        </div>

        {tasks.length === 0 ? (
          <p className="mt-8 text-sm text-slate">
            No open tasks assigned to you right now.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border/70">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {task.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate">
                    {task.project?.name || 'Assigned task'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-coral-tint px-2.5 py-1 text-[11px] font-medium text-coral-dark">
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border/80 bg-card px-5 py-4 sm:px-6">
        <p className="text-sm font-medium text-ink">Quick links</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/time"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate transition hover:bg-paper hover:text-ink"
          >
            <IconTime className="h-[18px] w-[18px] text-coral" />
            Time tracker
          </Link>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate transition hover:bg-paper hover:text-ink"
          >
            Tasks
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate transition hover:bg-paper hover:text-ink"
          >
            Projects
          </Link>
        </div>
      </section>
    </div>
  );
}
