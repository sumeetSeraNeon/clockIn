'use client';

import { useEffect, useState } from 'react';
import { ApprovalsReportPanel } from '@/components/reports/ApprovalsReportPanel';
import { BudgetReportPanel } from '@/components/reports/BudgetReportPanel';
import { ReportDetailedTable } from '@/components/reports/ReportDetailedTable';
import { ReportSummaryPanel } from '@/components/reports/ReportSummaryPanel';
import { UtilisationPanel } from '@/components/reports/UtilisationPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { toDateParam, weekRange } from '@/lib/date-range';
import { downloadCsv } from '@/lib/download-csv';
import {
  useReportApprovals,
  useReportBudget,
  useReportDetailed,
  useReportSummary,
  useReportUtilisation,
  type ReportFiltersState,
} from '@/lib/use-reports';
import { usePermissions } from '@/lib/use-permissions';
import type {
  Client,
  Member,
  Paginated,
  Project,
  ReportGroupBy,
  Task,
} from '@/types/api';

type Tab = 'summary' | 'detailed' | 'utilisation' | 'budget' | 'approvals';

function defaultFilters(): ReportFiltersState {
  const { from, to } = weekRange();
  return {
    dateFrom: toDateParam(from),
    dateTo: toDateParam(to),
    groupBy: 'project',
    clientId: 'all',
    projectId: 'all',
    userId: 'all',
    taskId: 'all',
    billable: 'all',
    entryStatus: 'approved',
    approvalStatus: 'all',
  };
}

/**
 * List 12 — Reports (summary, detailed, CSV, utilisation estimate).
 */
export default function ReportsPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const canView = can('report', 'view');
  const canViewMembers = can('member', 'view');
  const canViewRates = can('rate', 'view');

  const [tab, setTab] = useState<Tab>('summary');
  const [filters, setFilters] = useState<ReportFiltersState>(defaultFilters);
  const [page, setPage] = useState(1);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const summary = useReportSummary(
    filters,
    canView && tab === 'summary',
  );
  const detailed = useReportDetailed(
    filters,
    page,
    25,
    canView && tab === 'detailed',
  );
  const budget = useReportBudget(filters, canView && tab === 'budget');
  const approvals = useReportApprovals(
    filters,
    canView && tab === 'approvals',
  );
  const utilisation = useReportUtilisation(
    filters,
    canView && tab === 'utilisation',
  );

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;

    async function loadLookups() {
      try {
        const [clientsRes, projectsRes, tasksRes] = await Promise.all([
          api<Paginated<Client>>('/clients?pageSize=100&status=active'),
          api<Paginated<Project>>('/projects?pageSize=100&status=active'),
          api<Paginated<Task>>('/tasks?pageSize=100&status=open'),
        ]);
        let membersData: Member[] = [];
        if (canViewMembers) {
          const membersRes = await api<Paginated<Member>>(
            '/members?pageSize=100&status=active',
          );
          membersData = membersRes.data ?? [];
        }
        if (!cancelled) {
          setClients(clientsRes.data ?? []);
          setProjects(projectsRes.data ?? []);
          setTasks(tasksRes.data ?? []);
          setMembers(membersData);
        }
      } catch {
        if (!cancelled) {
          setClients([]);
          setProjects([]);
          setTasks([]);
          setMembers([]);
        }
      }
    }

    void loadLookups();
    return () => {
      cancelled = true;
    };
  }, [canView, canViewMembers]);

  function patchFilters(patch: Partial<ReportFiltersState>) {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function handleExportCsv() {
    if (tab === 'detailed') {
      if (detailed.data.length === 0) {
        toast.error('Nothing to export on this page');
        return;
      }
      downloadCsv(
        `clockin-detailed-${filters.dateFrom}-${filters.dateTo}.csv`,
        detailed.data.map((row) => ({
          date: String(row.entryDate).slice(0, 10),
          person: row.userName || row.userEmail,
          email: row.userEmail,
          client: row.clientName,
          project: row.projectName,
          task: row.taskName,
          durationMinutes: row.durationMinutes,
          billable: row.billable,
          revenue: row.revenue,
          currency: row.currency ?? 'GBP',
          description: row.description,
        })),
      );
      toast.success('CSV downloaded (current page)');
      return;
    }

    if (tab === 'approvals') {
      if (!approvals.data || approvals.data.slices.length === 0) {
        toast.error('Nothing to export');
        return;
      }
      downloadCsv(
        `clockin-approvals-${filters.dateFrom}-${filters.dateTo}.csv`,
        approvals.data.slices.map((row) => ({
          member: row.memberName,
          email: row.memberEmail,
          project: row.projectName,
          manager: row.managerName,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          status: row.status,
          submittedAt: row.submittedAt,
          decidedAt: row.decidedAt,
        })),
      );
      toast.success('CSV downloaded');
      return;
    }

    if (tab === 'budget') {
      if (!budget.data || budget.data.projects.length === 0) {
        toast.error('Nothing to export');
        return;
      }
      downloadCsv(
        `clockin-budget-${filters.dateFrom}-${filters.dateTo}.csv`,
        budget.data.projects.map((row) => ({
          project: row.projectName,
          code: row.projectCode,
          budgetHours: row.budgetHours,
          actualHours: row.actualHours,
          remainingBudgetHours: row.remainingBudgetHours,
          budgetBurnPct: row.budgetBurnPct,
          timelineElapsedPct: row.timelineElapsedPct,
          burnSignal: row.burnSignal,
          startDate: row.startDate,
          endDate: row.endDate,
          overBudgetActual: row.overBudgetActual,
          entryStatus: budget.data!.entryStatus,
        })),
      );
      toast.success('CSV downloaded');
      return;
    }

    if (tab === 'utilisation') {
      if (!utilisation.data || utilisation.data.people.length === 0) {
        toast.error('Nothing to export');
        return;
      }
      downloadCsv(
        `clockin-utilisation-${filters.dateFrom}-${filters.dateTo}.csv`,
        utilisation.data.people.map((row) => ({
          person: row.userName || row.userEmail,
          email: row.userEmail,
          trackedHours: row.trackedHours,
          billableHours: row.billableHours,
          availableHours: row.availableHours,
          billableUtilisationPct: row.billableUtilisationPct,
          trackedUtilisationPct: row.trackedUtilisationPct,
          calendarSource: row.calendarSource,
        })),
      );
      toast.success('CSV downloaded');
      return;
    }

    if (!summary.data || summary.data.groups.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    const commercial = summary.data.commercial === true;
    downloadCsv(
      `clockin-summary-${filters.dateFrom}-${filters.dateTo}.csv`,
      summary.data.groups.map((g) => ({
        label: g.label,
        durationMinutes: g.durationMinutes,
        billableMinutes: g.billableMinutes,
        nonBillableMinutes: g.nonBillableMinutes,
        revenue: commercial ? g.revenue : undefined,
        cost: commercial ? g.cost : undefined,
        margin: commercial ? g.margin : undefined,
        marginPercent: commercial ? g.marginPercent : undefined,
        currency: commercial ? (g.currency ?? 'GBP') : undefined,
      })),
    );
    toast.success('CSV downloaded');
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Reports"
          description="Hours, billable mix, and revenue for your organisation. Revenue uses approved time only."
        />
        <EmptyState
          title="No access"
          description="You need the report:view permission. Ask an owner or admin."
        />
      </div>
    );
  }

  const loading =
    tab === 'detailed'
      ? detailed.loading
      : tab === 'utilisation'
        ? utilisation.loading
        : tab === 'budget'
          ? budget.loading
          : tab === 'approvals'
            ? approvals.loading
            : summary.loading;
  const error =
    tab === 'detailed'
      ? detailed.error
      : tab === 'utilisation'
        ? utilisation.error
        : tab === 'budget'
          ? budget.error
          : tab === 'approvals'
            ? approvals.error
            : summary.error;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Reports"
        description="Profitability (approved revenue − cost), budget burn vs timeline, and billable utilisation. Money needs rate:view."
        actions={
          <Button type="button" variant="secondary" onClick={handleExportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="inline-flex flex-wrap rounded-md border border-border/80 bg-paper p-0.5">
        {(
          [
            ['summary', 'Summary'],
            ['detailed', 'Detailed'],
            ['utilisation', 'Utilisation'],
            ['budget', 'Budget'],
            ['approvals', 'Approvals'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              tab === id
                ? 'bg-card text-ink shadow-sm'
                : 'text-slate hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/80 bg-card px-4 py-4 sm:px-5">
        <label className="flex flex-col gap-1 text-xs text-slate">
          From
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => patchFilters({ dateFrom: e.target.value })}
            className="w-auto"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate">
          To
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => patchFilters({ dateTo: e.target.value })}
            className="w-auto"
          />
        </label>

        {tab === 'summary' ? (
          <label className="flex flex-col gap-1 text-xs text-slate">
            Group by
            <Select
              className="min-w-[140px]"
              value={filters.groupBy}
              onChange={(e) =>
                patchFilters({
                  groupBy: e.target.value as ReportGroupBy,
                })
              }
            >
              <option value="project">Project</option>
              <option value="client">Client</option>
              <option value="task">Task</option>
              <option value="user">Person</option>
              <option value="manager">Manager team</option>
            </Select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-xs text-slate">
          Client
          <Select
            className="min-w-[160px]"
            value={filters.clientId}
            onChange={(e) => patchFilters({ clientId: e.target.value })}
          >
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate">
          Project
          <Select
            className="min-w-[160px]"
            value={filters.projectId}
            onChange={(e) => patchFilters({ projectId: e.target.value })}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate">
          Person
          <Select
            className="min-w-[160px]"
            value={filters.userId}
            onChange={(e) => patchFilters({ userId: e.target.value })}
          >
            <option value="all">Anyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.userId}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </Select>
        </label>

        {tab === 'detailed' ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-slate">
              Task
              <Select
                className="min-w-[160px]"
                value={filters.taskId}
                onChange={(e) => patchFilters({ taskId: e.target.value })}
              >
                <option value="all">All tasks</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate">
              Billable
              <Select
                className="w-36"
                value={filters.billable}
                onChange={(e) =>
                  patchFilters({
                    billable: e.target.value as ReportFiltersState['billable'],
                  })
                }
              >
                <option value="all">All</option>
                <option value="true">Billable</option>
                <option value="false">Non-billable</option>
              </Select>
            </label>
          </>
        ) : null}

        {tab === 'budget' ? (
          <label className="flex flex-col gap-1 text-xs text-slate">
            Time status
            <Select
              className="min-w-[140px]"
              value={filters.entryStatus ?? 'approved'}
              onChange={(e) =>
                patchFilters({
                  entryStatus: e.target
                    .value as ReportFiltersState['entryStatus'],
                })
              }
            >
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="all">All</option>
            </Select>
          </label>
        ) : null}

        {tab === 'approvals' ? (
          <label className="flex flex-col gap-1 text-xs text-slate">
            Slice status
            <Select
              className="min-w-[140px]"
              value={filters.approvalStatus ?? 'all'}
              onChange={(e) =>
                patchFilters({
                  approvalStatus: e.target
                    .value as ReportFiltersState['approvalStatus'],
                })
              }
            >
              <option value="all">All</option>
              <option value="submitted">Waiting</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
          </label>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setFilters(defaultFilters());
            setPage(1);
          }}
        >
          This week
        </Button>
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <div className="rounded-lg border border-border/80 bg-card px-5 py-6">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => {
              summary.reload();
              detailed.reload();
              utilisation.reload();
              budget.reload();
              approvals.reload();
            }}
          >
            Try again
          </Button>
        </div>
      ) : tab === 'summary' && summary.data ? (
        <ReportSummaryPanel report={summary.data} />
      ) : tab === 'utilisation' && utilisation.data ? (
        <UtilisationPanel report={utilisation.data} />
      ) : tab === 'budget' && budget.data ? (
        <BudgetReportPanel report={budget.data} />
      ) : tab === 'approvals' && approvals.data ? (
        <ApprovalsReportPanel report={approvals.data} />
      ) : tab === 'detailed' ? (
        detailed.data.length === 0 ? (
          <EmptyState
            title="No approved lines in range"
            description="Only approved time appears here. Submit and approve timesheets, or adjust filters."
          />
        ) : (
          <>
            <p className="rounded-lg border border-border/80 bg-paper px-4 py-3 text-sm text-slate">
              Showing <span className="font-medium text-ink">approved time only</span>
              . Revenue on each line uses the rate effective on the entry date.
            </p>
            <ReportDetailedTable
              rows={detailed.data}
              commercial={canViewRates}
            />
            <Pagination
              page={page}
              totalPages={detailed.totalPages}
              total={detailed.total}
              pageSize={25}
              onPageChange={setPage}
            />
          </>
        )
      ) : (
        <EmptyState
          title="No data"
          description="Nothing matched these filters."
        />
      )}
    </div>
  );
}
