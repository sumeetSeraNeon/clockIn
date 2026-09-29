'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { Paginated, TimeEntry } from '@/types/api';

export type TimeEntriesQuery = {
  dateFrom: string;
  dateTo: string;
  page?: number;
  pageSize?: number;
};

export function useTimeEntries(query: TimeEntriesQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const { dateFrom, dateTo } = query;

  const [data, setData] = useState<TimeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          dateFrom,
          dateTo,
          page: String(page),
          pageSize: String(pageSize),
        });
        const result = await api<Paginated<TimeEntry>>(
          `/time-entries?${params.toString()}`,
        );
        if (!cancelled) {
          setData(result.data ?? []);
          setTotal(result.pagination?.total ?? 0);
        }
      } catch (err) {
        if (!cancelled) {
          setData([]);
          setTotal(0);
          setError(
            err instanceof Error ? err.message : 'Could not load time entries.',
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
  }, [dateFrom, dateTo, page, pageSize, reloadKey]);

  return { data, total, loading, error, reload };
}

/** Find a still-running timer entry (timer source + endTime null). */
export function findRunningEntry(entries: TimeEntry[]): TimeEntry | null {
  return (
    entries.find((e) => e.endTime === null && e.source === 'timer') ?? null
  );
}
