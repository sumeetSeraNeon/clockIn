'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type {
  ApprovalsReportResponse,
  BudgetReportResponse,
  Paginated,
  ReportDetailedLine,
  ReportGroupBy,
  ReportSummaryResponse,
  UtilisationReportResponse,
} from '@/types/api';

export type ReportFiltersState = {
  dateFrom: string;
  dateTo: string;
  groupBy: ReportGroupBy;
  clientId: string | 'all';
  projectId: string | 'all';
  userId: string | 'all';
  taskId: string | 'all';
  billable: 'all' | 'true' | 'false';
  /** Budget report: approved | pending | all */
  entryStatus?: 'approved' | 'pending' | 'all';
  /** Approvals report: all | submitted | approved | rejected */
  approvalStatus?: 'all' | 'submitted' | 'approved' | 'rejected';
};

function appendCommon(
  params: URLSearchParams,
  filters: ReportFiltersState,
  opts?: { includeTask?: boolean; includeBillable?: boolean },
) {
  params.set('dateFrom', filters.dateFrom);
  params.set('dateTo', filters.dateTo);
  if (filters.clientId !== 'all') params.set('clientId', filters.clientId);
  if (filters.projectId !== 'all') params.set('projectId', filters.projectId);
  if (filters.userId !== 'all') params.set('userId', filters.userId);
  if (opts?.includeTask && filters.taskId !== 'all') {
    params.set('taskId', filters.taskId);
  }
  if (opts?.includeBillable && filters.billable !== 'all') {
    params.set('billable', filters.billable);
  }
}

export function useReportSummary(filters: ReportFiltersState, enabled: boolean) {
  const [data, setData] = useState<ReportSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        appendCommon(params, filters, { includeTask: true });
        params.set('groupBy', filters.groupBy);
        const result = await api<ReportSummaryResponse>(
          `/reports/summary?${params.toString()}`,
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error ? err.message : 'Could not load summary.',
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
  }, [
    enabled,
    filters.dateFrom,
    filters.dateTo,
    filters.groupBy,
    filters.clientId,
    filters.projectId,
    filters.userId,
    filters.taskId,
    reloadKey,
  ]);

  return { data, loading, error, reload };
}

export function useReportDetailed(
  filters: ReportFiltersState,
  page: number,
  pageSize: number,
  enabled: boolean,
) {
  const [data, setData] = useState<ReportDetailedLine[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        appendCommon(params, filters, {
          includeTask: true,
          includeBillable: true,
        });
        const result = await api<Paginated<ReportDetailedLine>>(
          `/reports/detailed?${params.toString()}`,
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
            err instanceof Error ? err.message : 'Could not load detailed report.',
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
  }, [
    enabled,
    filters.dateFrom,
    filters.dateTo,
    filters.clientId,
    filters.projectId,
    filters.userId,
    filters.taskId,
    filters.billable,
    page,
    pageSize,
    reloadKey,
  ]);

  return { data, total, totalPages, loading, error, reload };
}

export function useReportBudget(
  filters: ReportFiltersState,
  enabled: boolean,
) {
  const [data, setData] = useState<BudgetReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          entryStatus: filters.entryStatus ?? 'approved',
        });
        if (filters.projectId !== 'all') {
          params.set('projectId', filters.projectId);
        }
        const result = await api<BudgetReportResponse>(
          `/reports/budget?${params.toString()}`,
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error ? err.message : 'Could not load budget report.',
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
  }, [
    enabled,
    filters.dateFrom,
    filters.dateTo,
    filters.projectId,
    filters.entryStatus,
    reloadKey,
  ]);

  return { data, loading, error, reload };
}

export function useReportApprovals(
  filters: ReportFiltersState,
  enabled: boolean,
) {
  const [data, setData] = useState<ApprovalsReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          status: filters.approvalStatus ?? 'all',
        });
        if (filters.projectId !== 'all') {
          params.set('projectId', filters.projectId);
        }
        if (filters.userId !== 'all') {
          params.set('userId', filters.userId);
        }
        const result = await api<ApprovalsReportResponse>(
          `/reports/approvals?${params.toString()}`,
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load approvals report.',
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
  }, [
    enabled,
    filters.dateFrom,
    filters.dateTo,
    filters.projectId,
    filters.userId,
    filters.approvalStatus,
    reloadKey,
  ]);

  return { data, loading, error, reload };
}

/** STEP 3 — billable utilisation from GET /reports/utilisation */
export function useReportUtilisation(
  filters: ReportFiltersState,
  enabled: boolean,
) {
  const [data, setData] = useState<UtilisationReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        appendCommon(params, filters);
        const result = await api<UtilisationReportResponse>(
          `/reports/utilisation?${params.toString()}`,
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load utilisation report.',
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
  }, [
    enabled,
    filters.dateFrom,
    filters.dateTo,
    filters.clientId,
    filters.projectId,
    filters.userId,
    reloadKey,
  ]);

  return { data, loading, error, reload };
}
