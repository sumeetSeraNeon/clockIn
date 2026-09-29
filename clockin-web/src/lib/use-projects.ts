'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { Paginated, Project, ProjectStatus } from '@/types/api';

export type ProjectsQuery = {
  page?: number;
  pageSize?: number;
  status?: ProjectStatus | 'all';
  clientId?: string | 'all';
};

export function useProjects(query: ProjectsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const status = query.status ?? 'all';
  const clientId = query.clientId ?? 'all';

  const [data, setData] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
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
          page: String(page),
          pageSize: String(pageSize),
        });
        if (status !== 'all') params.set('status', status);
        if (clientId !== 'all') params.set('clientId', clientId);

        const result = await api<Paginated<Project>>(
          `/projects?${params.toString()}`,
        );
        if (!cancelled) {
          setData(result.data ?? []);
          setTotal(result.pagination?.total ?? 0);
          setTotalPages(result.pagination?.totalPages ?? 0);
        }
      } catch (err) {
        if (!cancelled) {
          setData([]);
          setTotal(0);
          setTotalPages(0);
          setError(
            err instanceof Error ? err.message : 'Could not load projects.',
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
  }, [page, pageSize, status, clientId, reloadKey]);

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
