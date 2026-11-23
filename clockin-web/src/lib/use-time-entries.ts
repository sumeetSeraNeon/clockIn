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

/** Max pages per query (pageSize 100 → up to 5 000 entries). */
const MAX_PAGES = 50;

function mergeById(existing: TimeEntry[], incoming: TimeEntry[]): TimeEntry[] {
  const byId = new Map<string, TimeEntry>();
  for (const e of existing) byId.set(e.id, e);
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()];
}

/**
 * Load time entries for a date range. Keeps pageSize small per request,
 * then fetches remaining pages until total is covered (or MAX_PAGES).
 */
export function useTimeEntries(query: TimeEntriesQuery) {
  const startPage = query.page ?? 1;
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
        let page = startPage;
        let collected: TimeEntry[] = [];
        let reportedTotal = 0;

        while (page < startPage + MAX_PAGES) {
          const params = new URLSearchParams({
            dateFrom,
            dateTo,
            page: String(page),
            pageSize: String(pageSize),
          });
          const result = await api<Paginated<TimeEntry>>(
            `/time-entries?${params.toString()}`,
          );
          if (cancelled) return;

          const batch = result.data ?? [];
          reportedTotal = result.pagination?.total ?? reportedTotal;
          collected = mergeById(collected, batch);

          const done =
            batch.length === 0 ||
            collected.length >= reportedTotal ||
            batch.length < pageSize;
          if (done) break;
          page += 1;
        }

        if (!cancelled) {
          setData(collected);
          setTotal(reportedTotal);
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
  }, [dateFrom, dateTo, startPage, pageSize, reloadKey]);

  return { data, total, loading, error, reload };
}

/** Find a still-running timer entry (timer source + endTime null). */
export function findRunningEntry(entries: TimeEntry[]): TimeEntry | null {
  return (
    entries.find((e) => e.endTime === null && e.source === 'timer') ?? null
  );
}
