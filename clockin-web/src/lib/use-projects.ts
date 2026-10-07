'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, isAbortError } from '@/lib/api-client';
import type { Paginated, Project, ProjectStatus } from '@/types/api';

export type ProjectsQuery = {
  page?: number;
  pageSize?: number;
  status?: ProjectStatus | 'all';
  clientId?: string | 'all';
  /** Server-side name/code search */
  q?: string;
};

export function useProjects(query: ProjectsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const status = query.status ?? 'all';
  const clientId = query.clientId ?? 'all';
  const q = query.q?.trim() ?? '';

  const [data, setData] = useState<Project[]>([]);
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
        if (status !== 'all') params.set('status', status);
        if (clientId !== 'all') params.set('clientId', clientId);
        if (q) params.set('q', q);

        const result = await api<Paginated<Project>>(
          `/projects?${params.toString()}`,
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
          err instanceof Error ? err.message : 'Could not load projects.',
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
  }, [page, pageSize, status, clientId, q, reloadKey]);

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
