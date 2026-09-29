import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthMembership } from '../auth/auth.types';
import { can } from '../auth/permissions';
import { VisibilityService } from '../auth/visibility.service';
import {
  buildPaginatedResult,
  PaginatedResult,
  resolvePagination,
} from '../common/pagination';
import { mapPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import {
  ReportApprovalsQueryDto,
  ReportBudgetQueryDto,
  ReportDetailedQueryDto,
  ReportSummaryQueryDto,
} from './dto/report-query.dto';

type LineForReport = {
  id: string;
  organisationId: string;
  durationMinutes: number;
  billable: boolean;
  taskId: string | null;
  projectId: string | null;
  clientId: string | null;
  description: string | null;
  ticketType: string | null;
  area: string | null;
  timeEntry: {
    id: string;
    entryDate: Date;
    userId: string;
    user: { id: string; email: string; name: string | null };
  };
  task: {
    id: string;
    name: string;
    projectId: string;
    billable: boolean;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
    clientId: string;
  } | null;
  client: { id: string; name: string; code: string | null } | null;
};

/** FIX 6 — dimensions filled from task → project → client when denormalised ids are null. */
type NormalizedLine = LineForReport & {
  resolvedTaskId: string | null;
  resolvedProjectId: string | null;
  resolvedClientId: string | null;
};

const lineInclude = {
  timeEntry: {
    select: {
      id: true,
      entryDate: true,
      userId: true,
      user: { select: { id: true, email: true, name: true } },
    },
  },
  task: {
    select: { id: true, name: true, projectId: true, billable: true },
  },
  project: {
    select: { id: true, name: true, code: true, clientId: true },
  },
  client: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
    private readonly visibility: VisibilityService,
  ) {}

  async summary(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    query: ReportSummaryQueryDto,
  ) {
    this.assertDateRange(query.dateFrom, query.dateTo);
    const groupBy = query.groupBy ?? 'project';
    const commercial = can(membership.permissions, 'rate', 'view');

    // FINAL FIX 7 — revenue / billable rollups use approved time only
    const lines = await this.fetchLines(organisationId, membership, userId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      clientId: query.clientId,
      projectId: query.projectId,
      userId: query.userId,
      taskId: query.taskId,
      entryStatus: 'approved',
    });

    const pending = await this.sumPendingMinutes(
      organisationId,
      membership,
      userId,
      {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        clientId: query.clientId,
        projectId: query.projectId,
        userId: query.userId,
        taskId: query.taskId,
      },
    );

    const managerByUserId =
      groupBy === 'manager'
        ? await this.managerLabelsByUserId(organisationId)
        : null;

    type Acc = {
      key: string;
      label: string;
      clientId: string | null;
      projectId: string | null;
      taskId: string | null;
      userId: string | null;
      durationMinutes: number;
      billableMinutes: number;
      nonBillableMinutes: number;
      revenue: Prisma.Decimal;
      currency: string | null;
    };

    const groups = new Map<string, Acc>();
    let totalDuration = 0;
    let totalBillable = 0;
    let totalNonBillable = 0;
    let unratedBillableMinutes = 0;
    let totalRevenue = new Prisma.Decimal(0);
    let currency: string | null = null;

    for (const raw of lines) {
      const line = this.normalizeLine(raw);
      totalDuration += line.durationMinutes;
      if (line.billable) {
        totalBillable += line.durationMinutes;
      } else {
        totalNonBillable += line.durationMinutes;
      }

      const { key, label, clientId, projectId, taskId, userId: groupUserId } =
        this.groupKey(groupBy, line, managerByUserId);

      let acc = groups.get(key);
      if (!acc) {
        acc = {
          key,
          label,
          clientId,
          projectId,
          taskId,
          userId: groupUserId,
          durationMinutes: 0,
          billableMinutes: 0,
          nonBillableMinutes: 0,
          revenue: new Prisma.Decimal(0),
          currency: null,
        };
        groups.set(key, acc);
      }

      acc.durationMinutes += line.durationMinutes;
      if (line.billable) {
        acc.billableMinutes += line.durationMinutes;
        if (commercial) {
          const lineRevenue = await this.lineRevenue(organisationId, line);
          if (lineRevenue) {
            acc.revenue = acc.revenue.add(lineRevenue.amount);
            acc.currency = acc.currency ?? lineRevenue.currency;
            totalRevenue = totalRevenue.add(lineRevenue.amount);
            currency = currency ?? lineRevenue.currency;
          } else {
            unratedBillableMinutes += line.durationMinutes;
          }
        }
      } else {
        acc.nonBillableMinutes += line.durationMinutes;
      }
    }

    const mappedGroups = [...groups.values()]
      .sort((a, b) => b.durationMinutes - a.durationMinutes)
      .map((g) => ({
        key: g.key,
        label: g.label,
        clientId: g.clientId,
        projectId: g.projectId,
        taskId: g.taskId,
        userId: g.userId,
        durationMinutes: g.durationMinutes,
        billableMinutes: g.billableMinutes,
        nonBillableMinutes: g.nonBillableMinutes,
        billableHours: this.minutesToHours(g.billableMinutes),
        nonBillableHours: this.minutesToHours(g.nonBillableMinutes),
        ...(commercial
          ? { revenue: g.revenue.toFixed(2), currency: g.currency }
          : { revenue: null as string | null, currency: null as string | null }),
      }));

    // Groups sum must equal totals (same loop) — exposed for UI reconcile checks
    const groupsRevenue = commercial
      ? mappedGroups.reduce(
          (sum, g) => sum.add(new Prisma.Decimal(g.revenue ?? '0')),
          new Prisma.Decimal(0),
        )
      : new Prisma.Decimal(0);

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      groupBy,
      commercial,
      totals: {
        durationMinutes: totalDuration,
        billableMinutes: totalBillable,
        nonBillableMinutes: totalNonBillable,
        billableHours: this.minutesToHours(totalBillable),
        nonBillableHours: this.minutesToHours(totalNonBillable),
        revenue: commercial ? totalRevenue.toFixed(2) : null,
        currency: commercial ? currency : null,
        unratedBillableMinutes: commercial ? unratedBillableMinutes : 0,
        unratedBillableHours: commercial
          ? this.minutesToHours(unratedBillableMinutes)
          : 0,
        pendingDurationMinutes: pending.durationMinutes,
        pendingBillableMinutes: pending.billableMinutes,
        pendingDurationHours: this.minutesToHours(pending.durationMinutes),
        pendingBillableHours: this.minutesToHours(pending.billableMinutes),
      },
      groups: mappedGroups,
      reconcile: commercial
        ? {
            groupsRevenue: groupsRevenue.toFixed(2),
            matchesTotals: groupsRevenue.equals(totalRevenue),
            lineCount: lines.length,
          }
        : {
            groupsRevenue: '0.00',
            matchesTotals: true,
            lineCount: lines.length,
          },
      revenuePolicy: 'approved_only' as const,
    };
  }

  async detailed(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    query: ReportDetailedQueryDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    this.assertDateRange(query.dateFrom, query.dateTo);
    const { page, pageSize, skip, take } = resolvePagination(query);
    const commercial = can(membership.permissions, 'rate', 'view');

    const where = await this.lineWhere(
      organisationId,
      membership,
      userId,
      query,
    );

    try {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.timeLine.findMany({
          where,
          include: lineInclude,
          orderBy: [
            { timeEntry: { entryDate: 'desc' } },
            { createdAt: 'desc' },
          ],
          skip,
          take,
        }),
        this.prisma.timeLine.count({ where }),
      ]);

      const data: Record<string, unknown>[] = [];
      for (const raw of rows as LineForReport[]) {
        const line = this.normalizeLine(raw);
        const revenue =
          commercial && line.billable
            ? await this.lineRevenue(organisationId, line)
            : null;
        data.push({
          id: line.id,
          entryId: line.timeEntry.id,
          entryDate: line.timeEntry.entryDate,
          userId: line.timeEntry.userId,
          userEmail: line.timeEntry.user.email,
          userName: line.timeEntry.user.name,
          taskId: line.resolvedTaskId,
          taskName: line.task?.name ?? null,
          projectId: line.resolvedProjectId,
          projectName: line.project?.name ?? null,
          clientId: line.resolvedClientId,
          clientName: line.client?.name ?? null,
          durationMinutes: line.durationMinutes,
          hours: this.minutesToHours(line.durationMinutes),
          billable: line.billable,
          ticketType: line.ticketType,
          area: line.area,
          description: line.description,
          billableRate: commercial ? (revenue?.rate ?? null) : null,
          rateScope: commercial ? (revenue?.scope ?? null) : null,
          revenue: commercial && revenue ? revenue.amount.toFixed(2) : null,
          currency: commercial ? (revenue?.currency ?? null) : null,
          unrated: commercial ? line.billable && !revenue : false,
          commercial,
        });
      }

      return buildPaginatedResult(data, total, page, pageSize);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  /**
   * Phase2 FIX3 — budget vs estimate vs actual (+ early-finish under estimate).
   */
  async budget(
    organisationId: string,
    membership: AuthMembership,
    _userId: string,
    query: ReportBudgetQueryDto,
  ) {
    this.assertDateRange(query.dateFrom, query.dateTo);
    const entryStatus = query.entryStatus ?? 'approved';

    const projectVis = await this.visibility.projectWhere(
      organisationId,
      membership,
    );

    const projects = await this.prisma.project.findMany({
      where: {
        organisationId,
        ...projectVis,
        status: { not: 'archived' },
        ...(query.projectId ? { id: query.projectId } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        budgetHours: true,
        status: true,
        tasks: {
          where: { status: { in: ['open', 'done'] } },
          select: {
            id: true,
            name: true,
            status: true,
            estimatedHours: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const projectIds = projects.map((p) => p.id);
    const actualByProject = new Map<string, number>();
    const actualByTask = new Map<string, number>();

    if (projectIds.length > 0) {
      let statusFilter: Prisma.StringFilter | string | undefined;
      if (entryStatus === 'approved') {
        statusFilter = 'approved';
      } else if (entryStatus === 'pending') {
        statusFilter = { not: 'approved' };
      } else {
        statusFilter = undefined;
      }

      const lines = await this.prisma.timeLine.findMany({
        where: {
          organisationId,
          projectId: { in: projectIds },
          timeEntry: {
            organisationId,
            entryDate: {
              gte: new Date(query.dateFrom),
              lte: new Date(query.dateTo),
            },
            ...(statusFilter !== undefined ? { status: statusFilter } : {}),
          },
        },
        select: {
          projectId: true,
          taskId: true,
          durationMinutes: true,
        },
      });

      for (const line of lines) {
        if (line.projectId) {
          actualByProject.set(
            line.projectId,
            (actualByProject.get(line.projectId) ?? 0) + line.durationMinutes,
          );
        }
        if (line.taskId) {
          actualByTask.set(
            line.taskId,
            (actualByTask.get(line.taskId) ?? 0) + line.durationMinutes,
          );
        }
      }
    }

    const projectRows = projects.map((project) => {
      const budgetHours =
        project.budgetHours != null ? Number(project.budgetHours) : null;
      const estimatedHours = project.tasks.reduce(
        (sum, t) =>
          sum + (t.estimatedHours != null ? Number(t.estimatedHours) : 0),
        0,
      );
      const actualMinutes = actualByProject.get(project.id) ?? 0;
      const actualHours = actualMinutes / 60;
      const overBudgetEstimate =
        budgetHours != null && estimatedHours > budgetHours + 1e-9;
      const overBudgetActual =
        budgetHours != null && actualHours > budgetHours + 1e-9;

      const tasks = project.tasks.map((task) => {
        const estimate =
          task.estimatedHours != null ? Number(task.estimatedHours) : null;
        const taskActualMinutes = actualByTask.get(task.id) ?? 0;
        const taskActualHours = taskActualMinutes / 60;
        const underEstimate =
          task.status === 'done' &&
          estimate != null &&
          estimate > 0 &&
          taskActualHours < estimate - 1e-9;

        return {
          taskId: task.id,
          taskName: task.name,
          status: task.status,
          estimatedHours: estimate,
          actualHours: Number(taskActualHours.toFixed(2)),
          actualMinutes: taskActualMinutes,
          underEstimate,
          varianceHours:
            estimate != null
              ? Number((taskActualHours - estimate).toFixed(2))
              : null,
        };
      });

      return {
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        status: project.status,
        budgetHours,
        estimatedHours: Number(estimatedHours.toFixed(2)),
        actualHours: Number(actualHours.toFixed(2)),
        actualMinutes,
        remainingBudgetHours:
          budgetHours != null
            ? Number((budgetHours - actualHours).toFixed(2))
            : null,
        overBudgetEstimate,
        overBudgetActual,
        tasks,
      };
    });

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      entryStatus,
      projects: projectRows,
    };
  }

  /**
   * Phase2 FIX5 — waiting / approved / rejected approval pipeline (slices).
   */
  async approvalsReport(
    organisationId: string,
    membership: AuthMembership,
    _userId: string,
    query: ReportApprovalsQueryDto,
  ) {
    this.assertDateRange(query.dateFrom, query.dateTo);
    const statusFilter = query.status ?? 'all';

    const projectVis = await this.visibility.projectWhere(
      organisationId,
      membership,
    );
    const visibleProjects = await this.prisma.project.findMany({
      where: { organisationId, ...projectVis },
      select: { id: true },
    });
    const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
    const canSeeAllProjects = Object.keys(projectVis).length === 0;

    const slices = await this.prisma.timesheetPeriodSlice.findMany({
      where: {
        organisationId,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        timesheetPeriod: {
          organisationId,
          ...(query.userId ? { userId: query.userId } : {}),
          OR: [
            {
              periodStart: {
                gte: new Date(query.dateFrom),
                lte: new Date(query.dateTo),
              },
            },
            {
              periodEnd: {
                gte: new Date(query.dateFrom),
                lte: new Date(query.dateTo),
              },
            },
            {
              AND: [
                { periodStart: { lte: new Date(query.dateFrom) } },
                { periodEnd: { gte: new Date(query.dateTo) } },
              ],
            },
          ],
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        timesheetPeriod: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const rows = [];
    for (const slice of slices) {
      if (
        !canSeeAllProjects &&
        slice.projectId &&
        !visibleProjectIds.has(slice.projectId)
      ) {
        continue;
      }
      // Null-project slices: only if admin/all or caller is line manager — use projectVis empty as proxy for broad view; otherwise include for report:view holders who see all projects
      if (!canSeeAllProjects && !slice.projectId) {
        continue;
      }

      const managerName = slice.project?.owner
        ? slice.project.owner.user.name || slice.project.owner.user.email
        : null;

      rows.push({
        sliceId: slice.id,
        periodId: slice.timesheetPeriodId,
        status: slice.status,
        projectId: slice.projectId,
        projectName: slice.project?.name ?? 'No project',
        projectCode: slice.project?.code ?? null,
        managerMembershipId: slice.project?.ownerId ?? null,
        managerName,
        memberUserId: slice.timesheetPeriod.userId,
        memberName:
          slice.timesheetPeriod.user.name ||
          slice.timesheetPeriod.user.email,
        memberEmail: slice.timesheetPeriod.user.email,
        periodStart: slice.timesheetPeriod.periodStart
          ? slice.timesheetPeriod.periodStart.toISOString().slice(0, 10)
          : null,
        periodEnd: slice.timesheetPeriod.periodEnd
          ? slice.timesheetPeriod.periodEnd.toISOString().slice(0, 10)
          : null,
        submittedAt: slice.timesheetPeriod.submittedAt,
        decidedAt: slice.decidedAt,
      });
    }

    const counts = {
      submitted: rows.filter((r) => r.status === 'submitted').length,
      approved: rows.filter((r) => r.status === 'approved').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
      total: rows.length,
    };

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      status: statusFilter,
      counts,
      slices: rows,
    };
  }

  private async fetchLines(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    filters: {
      dateFrom: string;
      dateTo: string;
      clientId?: string;
      projectId?: string;
      userId?: string;
      taskId?: string;
      billable?: boolean;
      /** FINAL FIX 7 — default approved for report rollups */
      entryStatus?: 'approved' | 'pending' | 'all';
    },
  ): Promise<LineForReport[]> {
    try {
      return (await this.prisma.timeLine.findMany({
        where: await this.lineWhere(
          organisationId,
          membership,
          userId,
          filters,
        ),
        include: lineInclude,
        orderBy: { createdAt: 'asc' },
      })) as LineForReport[];
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private async lineWhere(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    filters: {
      dateFrom: string;
      dateTo: string;
      clientId?: string;
      projectId?: string;
      userId?: string;
      taskId?: string;
      billable?: boolean;
      entryStatus?: 'approved' | 'pending' | 'all';
    },
  ): Promise<Prisma.TimeLineWhereInput> {
    const visibilityWhere = await this.visibility.timeLineReportWhere(
      organisationId,
      membership,
      userId,
    );

    const entryStatus = filters.entryStatus ?? 'approved';
    let statusFilter: Prisma.StringFilter | string | undefined;
    if (entryStatus === 'approved') {
      statusFilter = 'approved';
    } else if (entryStatus === 'pending') {
      statusFilter = { not: 'approved' };
    } else {
      statusFilter = undefined;
    }

    return {
      organisationId,
      AND: [
        visibilityWhere,
        {
          ...(filters.clientId ? { clientId: filters.clientId } : {}),
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
          ...(filters.taskId ? { taskId: filters.taskId } : {}),
          ...(filters.billable !== undefined
            ? { billable: filters.billable }
            : {}),
          timeEntry: {
            organisationId,
            entryDate: {
              gte: new Date(filters.dateFrom),
              lte: new Date(filters.dateTo),
            },
            ...(filters.userId ? { userId: filters.userId } : {}),
            ...(statusFilter !== undefined ? { status: statusFilter } : {}),
          },
        },
      ],
    };
  }

  /** Unapproved minutes in range (not counted toward revenue). */
  private async sumPendingMinutes(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    filters: {
      dateFrom: string;
      dateTo: string;
      clientId?: string;
      projectId?: string;
      userId?: string;
      taskId?: string;
    },
  ): Promise<{ durationMinutes: number; billableMinutes: number }> {
    const where = await this.lineWhere(organisationId, membership, userId, {
      ...filters,
      entryStatus: 'pending',
    });

    try {
      const lines = await this.prisma.timeLine.findMany({
        where,
        select: { durationMinutes: true, billable: true },
      });
      let durationMinutes = 0;
      let billableMinutes = 0;
      for (const line of lines) {
        durationMinutes += line.durationMinutes;
        if (line.billable) billableMinutes += line.durationMinutes;
      }
      return { durationMinutes, billableMinutes };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  /**
   * FIX 6 — fill missing denormalised FKs from task → project → client.
   * Keeps grouping and rate lookup aligned with the commercial hierarchy.
   */
  private normalizeLine(line: LineForReport): NormalizedLine {
    const resolvedTaskId = line.taskId ?? line.task?.id ?? null;
    const resolvedProjectId =
      line.projectId ??
      line.task?.projectId ??
      line.project?.id ??
      null;
    const resolvedClientId =
      line.clientId ??
      line.project?.clientId ??
      line.client?.id ??
      null;

    return {
      ...line,
      taskId: resolvedTaskId,
      projectId: resolvedProjectId,
      clientId: resolvedClientId,
      resolvedTaskId,
      resolvedProjectId,
      resolvedClientId,
    };
  }

  private async managerLabelsByUserId(
    organisationId: string,
  ): Promise<Map<string, { key: string; label: string }>> {
    const memberships = await this.prisma.membership.findMany({
      where: { organisationId, status: 'active' },
      select: {
        userId: true,
        managerId: true,
        manager: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    const map = new Map<string, { key: string; label: string }>();
    for (const m of memberships) {
      if (!m.managerId || !m.manager) {
        map.set(m.userId, {
          key: 'unassigned',
          label: 'No line manager',
        });
      } else {
        map.set(m.userId, {
          key: m.manager.id,
          label:
            m.manager.user.name ||
            m.manager.user.email ||
            'Manager',
        });
      }
    }
    return map;
  }

  private groupKey(
    groupBy: 'project' | 'client' | 'user' | 'task' | 'manager',
    line: NormalizedLine,
    managerByUserId?: Map<string, { key: string; label: string }> | null,
  ): {
    key: string;
    label: string;
    clientId: string | null;
    projectId: string | null;
    taskId: string | null;
    userId: string | null;
  } {
    if (groupBy === 'manager') {
      const info = managerByUserId?.get(line.timeEntry.userId);
      return {
        key: info?.key ?? 'unassigned',
        label: info?.label ?? 'No line manager',
        clientId: null,
        projectId: null,
        taskId: null,
        userId: null,
      };
    }
    if (groupBy === 'client') {
      return {
        key: line.resolvedClientId ?? 'unassigned',
        label: line.client?.name ?? 'Unassigned client',
        clientId: line.resolvedClientId,
        projectId: null,
        taskId: null,
        userId: null,
      };
    }
    if (groupBy === 'user') {
      return {
        key: line.timeEntry.userId,
        label:
          line.timeEntry.user.name ??
          line.timeEntry.user.email ??
          line.timeEntry.userId,
        clientId: null,
        projectId: null,
        taskId: null,
        userId: line.timeEntry.userId,
      };
    }
    if (groupBy === 'task') {
      return {
        key: line.resolvedTaskId ?? 'unassigned',
        label: line.task?.name ?? 'Unassigned task',
        clientId: line.resolvedClientId,
        projectId: line.resolvedProjectId,
        taskId: line.resolvedTaskId,
        userId: null,
      };
    }
    return {
      key: line.resolvedProjectId ?? 'unassigned',
      label: line.project?.name ?? 'Unassigned project',
      clientId: line.resolvedClientId,
      projectId: line.resolvedProjectId,
      taskId: null,
      userId: null,
    };
  }

  /**
   * Revenue = hours × most-specific billable rate on the entry date.
   * Only for billable lines (FIX 5 inheritance). Non-billable → null.
   */
  private async lineRevenue(
    organisationId: string,
    line: NormalizedLine,
  ): Promise<{
    amount: Prisma.Decimal;
    rate: string;
    scope: string | null;
    currency: string | null;
  } | null> {
    const lookup = await this.rates.lookup(organisationId, {
      rateType: 'billable',
      date: line.timeEntry.entryDate.toISOString(),
      clientId: line.resolvedClientId ?? undefined,
      projectId: line.resolvedProjectId ?? undefined,
      userId: line.timeEntry.userId,
      taskId: line.resolvedTaskId ?? undefined,
    });

    if (!lookup.amount) {
      return null;
    }

    const hourly = new Prisma.Decimal(lookup.amount);
    const hours = new Prisma.Decimal(line.durationMinutes).div(60);
    return {
      amount: hourly.mul(hours),
      rate: lookup.amount,
      scope: lookup.matchedScope,
      currency: lookup.currency,
    };
  }

  private minutesToHours(minutes: number): string {
    return new Prisma.Decimal(minutes).div(60).toFixed(2);
  }

  private assertDateRange(dateFrom: string, dateTo: string): void {
    if (new Date(dateTo) < new Date(dateFrom)) {
      throw new BadRequestException('dateTo cannot be before dateFrom');
    }
  }
}
