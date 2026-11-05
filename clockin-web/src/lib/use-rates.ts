'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, isAbortError } from '@/lib/api-client';
import type {
  Paginated,
  Rate,
  RateScope,
  RateType,
} from '@/types/api';

export type RatesQuery = {
  page?: number;
  pageSize?: number;
  rateType?: RateType | 'all';
  scope?: RateScope | 'all';
  clientId?: string | 'all';
  projectId?: string | 'all';
  userId?: string | 'all';
  taskId?: string | 'all';
  /** true = current tab only. Track omits this and sends month instead. */
  current?: boolean;
  /** YYYY-MM. Track lists every rate overlapping this month. */
  month?: string;
  /** Server search across project, person, email, client, and task. */
  q?: string;
};

export function useRates(query: RatesQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const rateType = query.rateType ?? 'all';
  const scope = query.scope ?? 'all';
  const clientId = query.clientId ?? 'all';
  const projectId = query.projectId ?? 'all';
  const userId = query.userId ?? 'all';
  const taskId = query.taskId ?? 'all';
  const current = query.current;
  const month = query.month?.trim() ?? '';
  const q = query.q?.trim() ?? '';

  const [data, setData] = useState<Rate[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (rateType !== 'all') params.set('rateType', rateType);
        if (scope !== 'all') params.set('scope', scope);
        if (clientId !== 'all') params.set('clientId', clientId);
        if (projectId !== 'all') params.set('projectId', projectId);
        if (userId !== 'all') params.set('userId', userId);
        if (taskId !== 'all') params.set('taskId', taskId);
        if (current === true) params.set('current', 'true');
        if (current === false) params.set('current', 'false');
        if (month) params.set('month', month);
        if (q) params.set('q', q);

        const result = await api<Paginated<Rate>>(
          `/rates?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!cancelled) {
          setData(result.data ?? []);
          setTotal(result.pagination?.total ?? 0);
          setTotalPages(result.pagination?.totalPages ?? 0);
        }
      } catch (err) {
        if (cancelled || isAbortError(err)) return;
        setData([]);
        setTotal(0);
        setTotalPages(0);
        setError(
          err instanceof Error ? err.message : 'Could not load rates.',
        );
      } finally {
        if (!cancelled && !controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    page,
    pageSize,
    rateType,
    scope,
    clientId,
    projectId,
    userId,
    taskId,
    current,
    month,
    q,
    reloadKey,
  ]);

  return {
    data,
    total,
    totalPages,
    page,
    pageSize,
    loading,
    error,
    reload,
  };
}

/** Prefer server `isCurrent`; fall back for older payloads. */
export function isRateCurrent(rate: Rate, today = new Date()): boolean {
  return rateTiming(rate.effectiveFrom, rate.effectiveTo, today) === 'Current';
}

export type RateTiming = 'Current' | 'Upcoming' | 'Ended';

/** Current covers today. Upcoming starts later. Ended finished before today. */
export function rateTiming(
  effectiveFrom: string | null | undefined,
  effectiveTo: string | null | undefined,
  today = new Date(),
): RateTiming {
  const todayKey = localDateKey(today);
  const from = effectiveFrom?.slice(0, 10) ?? '';
  if (from && from > todayKey) return 'Upcoming';
  if (!effectiveTo) return 'Current';
  const ends = effectiveTo
    .split(' / ')
    .map((part) => part.slice(0, 10))
    .filter(Boolean);
  if (ends.length > 0 && ends.every((end) => end < todayKey)) return 'Ended';
  return 'Current';
}

function localDateKey(today: Date): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
