'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, isAbortError } from '@/lib/api-client';
import type {
  Paginated,
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@/types/api';

export type TicketsQuery = {
  page?: number;
  pageSize?: number;
  status?: TicketStatus | 'all';
  clientId?: string | 'all';
  projectId?: string | 'all';
  ticketType?: TicketType | 'all';
  priority?: TicketPriority | 'all';
  /** Server-side reference/title search */
  q?: string;
  /** When false, skip the fetch (e.g. inactive project tab). */
  enabled?: boolean;
};

export function useTickets(query: TicketsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const status = query.status ?? 'all';
  const clientId = query.clientId ?? 'all';
  const projectId = query.projectId ?? 'all';
  const ticketType = query.ticketType ?? 'all';
  const priority = query.priority ?? 'all';
  const q = query.q?.trim() ?? '';
  const enabled = query.enabled !== false;

  const [data, setData] = useState<Ticket[]>([]);
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
      if (!enabled) {
        setData([]);
        setTotal(0);
        setTotalPages(0);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (status !== 'all') params.set('status', status);
        if (clientId !== 'all') params.set('clientId', clientId);
        if (projectId !== 'all') params.set('projectId', projectId);
        if (ticketType !== 'all') params.set('ticketType', ticketType);
        if (priority !== 'all') params.set('priority', priority);
        if (q) params.set('q', q);

        const result = await api<Paginated<Ticket>>(
          `/tickets?${params.toString()}`,
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
          err instanceof Error ? err.message : 'Could not load tickets.',
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
    enabled,
    page,
    pageSize,
    status,
    clientId,
    projectId,
    ticketType,
    priority,
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
