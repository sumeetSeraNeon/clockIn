import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Rate } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  buildPaginatedResult,
  PaginatedResult,
  resolvePagination,
} from '../common/pagination';
import { mapPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRateDto } from './dto/create-rate.dto';
import { ListRatesQueryDto } from './dto/list-rates-query.dto';
import { LookupRateDto } from './dto/lookup-rate.dto';

const ENTITY_TYPE = 'rate';

/**
 * Most-specific scope wins (API guide + schema task scope).
 * project_user > project > client > user > organisation, with task highest.
 */
const SCOPE_PRIORITY: Record<string, number> = {
  task: 60,
  project_user: 50,
  project: 40,
  client: 30,
  user: 20,
  organisation: 10,
};

export type RateListItem = {
  id: string;
  organisationId: string;
  organisationName: string;
  rateType: string;
  scope: string;
  clientId: string | null;
  projectId: string | null;
  userId: string | null;
  taskId: string | null;
  clientName: string | null;
  projectName: string | null;
  userName: string | null;
  userEmail: string | null;
  taskName: string | null;
  appliesToLabel: string;
  amount: string;
  currency: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  isCurrent: boolean;
};

export type RateLookupResult = {
  rate: Rate | null;
  matchedScope: string | null;
  amount: string | null;
  currency: string | null;
};

@Injectable()
export class RatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    organisationId: string,
    actorMembershipId: string,
    dto: CreateRateDto,
  ): Promise<Rate> {
    this.assertScopeFields(dto);
    await this.assertScopeParents(organisationId, dto);

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo =
      dto.effectiveTo === undefined || dto.effectiveTo === null
        ? null
        : new Date(dto.effectiveTo);

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo cannot be before effectiveFrom',
      );
    }

    try {
      const org = await this.prisma.organisation.findUnique({
        where: { id: organisationId },
        select: { currency: true },
      });
      const currency = dto.currency ?? org?.currency ?? 'GBP';

      const rate = await this.prisma.$transaction(async (tx) => {
        // Close previous open-ended rate for the same identity (history preserved).
        if (effectiveTo === null) {
          const dayBefore = new Date(effectiveFrom);
          dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

          await tx.rate.updateMany({
            where: {
              organisationId,
              rateType: dto.rateType,
              scope: dto.scope,
              clientId: dto.clientId ?? null,
              projectId: dto.projectId ?? null,
              userId: dto.userId ?? null,
              taskId: dto.taskId ?? null,
              effectiveTo: null,
              effectiveFrom: { lt: effectiveFrom },
            },
            data: { effectiveTo: dayBefore },
          });
        }

        return tx.rate.create({
          data: {
            organisationId,
            rateType: dto.rateType,
            scope: dto.scope,
            clientId: dto.clientId,
            projectId: dto.projectId,
            userId: dto.userId,
            taskId: dto.taskId,
            amount: new Prisma.Decimal(dto.amount),
            currency,
            effectiveFrom,
            effectiveTo,
          },
        });
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: rate.id,
        action: 'create',
        oldValue: null,
        newValue: this.toAuditJson(rate),
      });

      return rate;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      mapPrismaError(error);
    }
  }

  async findAll(
    organisationId: string,
    query: ListRatesQueryDto,
  ): Promise<PaginatedResult<RateListItem>> {
    const { page, pageSize, skip, take } = resolvePagination(query);
    const today = this.todayUtcDate();

    const where: Prisma.RateWhereInput = {
      organisationId,
      ...(query.rateType ? { rateType: query.rateType } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.taskId ? { taskId: query.taskId } : {}),
      ...(query.current === true
        ? {
            effectiveFrom: { lte: today },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
          }
        : {}),
      ...(query.current === false
        ? {
            OR: [
              { effectiveFrom: { gt: today } },
              { effectiveTo: { lt: today } },
            ],
          }
        : {}),
    };

    try {
      const org = await this.prisma.organisation.findUnique({
        where: { id: organisationId },
        select: { name: true },
      });
      const organisationName = org?.name ?? 'Organisation';

      const [rows, total] = await this.prisma.$transaction([
        this.prisma.rate.findMany({
          where,
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
          skip,
          take,
          include: {
            client: { select: { id: true, name: true } },
            project: {
              select: {
                id: true,
                name: true,
                client: { select: { name: true } },
              },
            },
            user: { select: { id: true, name: true, email: true } },
            task: {
              select: {
                id: true,
                name: true,
                project: { select: { name: true } },
              },
            },
          },
        }),
        this.prisma.rate.count({ where }),
      ]);

      const data = rows.map((rate) =>
        this.toListItem(rate, organisationName, today),
      );

      return buildPaginatedResult(data, total, page, pageSize);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private todayUtcDate(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private isRateCurrent(
    effectiveFrom: Date,
    effectiveTo: Date | null,
    today: Date,
  ): boolean {
    if (effectiveFrom > today) return false;
    if (effectiveTo == null) return true;
    return effectiveTo >= today;
  }

  private toListItem(
    rate: Rate & {
      client: { id: string; name: string } | null;
      project: {
        id: string;
        name: string;
        client: { name: string } | null;
      } | null;
      user: { id: string; name: string | null; email: string } | null;
      task: {
        id: string;
        name: string;
        project: { name: string } | null;
      } | null;
    },
    organisationName: string,
    today: Date,
  ): RateListItem {
    const clientName = rate.client?.name ?? null;
    const projectName = rate.project?.name ?? null;
    const userName = rate.user?.name ?? null;
    const userEmail = rate.user?.email ?? null;
    const taskName = rate.task?.name ?? null;
    const personLabel = userName || userEmail;

    let appliesToLabel: string;
    switch (rate.scope) {
      case 'organisation':
        appliesToLabel = `${organisationName} (organisation default)`;
        break;
      case 'client':
        appliesToLabel = clientName ?? 'Client';
        break;
      case 'project': {
        const clientFromProject = rate.project?.client?.name;
        appliesToLabel = clientFromProject
          ? `${clientFromProject} · ${projectName ?? 'Project'}`
          : (projectName ?? 'Project');
        break;
      }
      case 'user':
        appliesToLabel = personLabel
          ? userEmail && userName
            ? `${userName} (${userEmail})`
            : personLabel
          : 'Person';
        break;
      case 'task': {
        const projectFromTask = rate.task?.project?.name;
        appliesToLabel = projectFromTask
          ? `${projectFromTask} · ${taskName ?? 'Task'}`
          : (taskName ?? 'Task');
        break;
      }
      case 'project_user':
        appliesToLabel = `${projectName ?? 'Project'} · ${personLabel ?? 'Person'}`;
        break;
      default:
        appliesToLabel = organisationName;
    }

    return {
      id: rate.id,
      organisationId: rate.organisationId,
      organisationName,
      rateType: rate.rateType,
      scope: rate.scope,
      clientId: rate.clientId,
      projectId: rate.projectId,
      userId: rate.userId,
      taskId: rate.taskId,
      clientName,
      projectName,
      userName,
      userEmail,
      taskName,
      appliesToLabel,
      amount: rate.amount.toString(),
      currency: rate.currency,
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
      createdAt: rate.createdAt,
      isCurrent: this.isRateCurrent(
        rate.effectiveFrom,
        rate.effectiveTo,
        today,
      ),
    };
  }

  /**
   * Find the most-specific rate covering `date` for the given context.
   * Used by reporting later; also exposed via POST /rates/lookup.
   */
  async lookup(
    organisationId: string,
    dto: LookupRateDto,
  ): Promise<RateLookupResult> {
    let clientId = dto.clientId ?? null;
    let projectId = dto.projectId ?? null;
    let userId = dto.userId ?? null;
    let taskId = dto.taskId ?? null;
    const onDate = new Date(dto.date);

    if (dto.timeLineId) {
      const line = await this.prisma.timeLine.findFirst({
        where: { id: dto.timeLineId, organisationId },
        include: {
          timeEntry: { select: { userId: true, entryDate: true } },
          task: { select: { projectId: true } },
          project: { select: { clientId: true } },
        },
      });
      if (!line) {
        throw new NotFoundException('Time line not found');
      }
      taskId = line.taskId;
      projectId = line.projectId ?? line.task?.projectId ?? null;
      clientId =
        line.clientId ?? line.project?.clientId ?? null;
      userId = line.timeEntry.userId;
    }

    // FIX 6 — fill hierarchy when only a more-specific id is supplied
    if (taskId && (!projectId || !clientId)) {
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, organisationId },
        select: {
          projectId: true,
          project: { select: { clientId: true } },
        },
      });
      if (task) {
        projectId = projectId ?? task.projectId;
        clientId = clientId ?? task.project.clientId;
      }
    } else if (projectId && !clientId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organisationId },
        select: { clientId: true },
      });
      if (project) {
        clientId = project.clientId;
      }
    }

    const candidates = await this.prisma.rate.findMany({
      where: {
        organisationId,
        rateType: dto.rateType,
        effectiveFrom: { lte: onDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }],
      },
    });

    const matching = candidates.filter((rate) =>
      this.rateMatchesContext(rate, {
        clientId,
        projectId,
        userId,
        taskId,
      }),
    );

    matching.sort((a, b) => {
      const pa = SCOPE_PRIORITY[a.scope] ?? 0;
      const pb = SCOPE_PRIORITY[b.scope] ?? 0;
      if (pb !== pa) return pb - pa;
      return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    });

    const best = matching[0] ?? null;
    return {
      rate: best,
      matchedScope: best?.scope ?? null,
      amount: best ? best.amount.toString() : null,
      currency: best?.currency ?? null,
    };
  }

  private rateMatchesContext(
    rate: Rate,
    ctx: {
      clientId: string | null;
      projectId: string | null;
      userId: string | null;
      taskId: string | null;
    },
  ): boolean {
    switch (rate.scope) {
      case 'organisation':
        return true;
      case 'client':
        return !!ctx.clientId && rate.clientId === ctx.clientId;
      case 'project':
        return !!ctx.projectId && rate.projectId === ctx.projectId;
      case 'user':
        return !!ctx.userId && rate.userId === ctx.userId;
      case 'task':
        return !!ctx.taskId && rate.taskId === ctx.taskId;
      case 'project_user':
        return (
          !!ctx.projectId &&
          !!ctx.userId &&
          rate.projectId === ctx.projectId &&
          rate.userId === ctx.userId
        );
      default:
        return false;
    }
  }

  private assertScopeFields(dto: CreateRateDto): void {
    const extras: string[] = [];
    const missing: string[] = [];

    const has = {
      clientId: !!dto.clientId,
      projectId: !!dto.projectId,
      userId: !!dto.userId,
      taskId: !!dto.taskId,
    };

    switch (dto.scope) {
      case 'organisation':
        if (has.clientId || has.projectId || has.userId || has.taskId) {
          extras.push('organisation scope must not set parent ids');
        }
        break;
      case 'client':
        if (!has.clientId) missing.push('clientId');
        if (has.projectId || has.userId || has.taskId) {
          extras.push('client scope only allows clientId');
        }
        break;
      case 'project':
        if (!has.projectId) missing.push('projectId');
        if (has.clientId || has.userId || has.taskId) {
          extras.push('project scope only allows projectId');
        }
        break;
      case 'user':
        if (!has.userId) missing.push('userId');
        if (has.clientId || has.projectId || has.taskId) {
          extras.push('user scope only allows userId');
        }
        break;
      case 'task':
        if (!has.taskId) missing.push('taskId');
        if (has.clientId || has.projectId || has.userId) {
          extras.push('task scope only allows taskId');
        }
        break;
      case 'project_user':
        if (!has.projectId) missing.push('projectId');
        if (!has.userId) missing.push('userId');
        if (has.clientId || has.taskId) {
          extras.push('project_user scope only allows projectId + userId');
        }
        break;
      default:
        throw new BadRequestException(`Unknown scope: ${dto.scope}`);
    }

    if (missing.length || extras.length) {
      throw new BadRequestException(
        [...(missing.length ? [`Missing: ${missing.join(', ')}`] : []), ...extras].join(
          '. ',
        ),
      );
    }
  }

  private async assertScopeParents(
    organisationId: string,
    dto: CreateRateDto,
  ): Promise<void> {
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, organisationId },
        select: { id: true },
      });
      if (!client) {
        throw new BadRequestException(
          'clientId must belong to your organisation',
        );
      }
    }
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organisationId },
        select: { id: true },
      });
      if (!project) {
        throw new BadRequestException(
          'projectId must belong to your organisation',
        );
      }
    }
    if (dto.userId) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          organisationId,
          userId: dto.userId,
        },
        select: { id: true },
      });
      if (!membership) {
        throw new BadRequestException(
          'userId must belong to a member of your organisation',
        );
      }
    }
    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: dto.taskId, organisationId },
        select: { id: true },
      });
      if (!task) {
        throw new BadRequestException(
          'taskId must belong to your organisation',
        );
      }
    }
  }

  private toAuditJson(rate: Rate): Prisma.InputJsonValue {
    return {
      id: rate.id,
      organisationId: rate.organisationId,
      rateType: rate.rateType,
      scope: rate.scope,
      clientId: rate.clientId,
      projectId: rate.projectId,
      userId: rate.userId,
      taskId: rate.taskId,
      amount: rate.amount.toString(),
      currency: rate.currency,
      effectiveFrom: rate.effectiveFrom.toISOString(),
      effectiveTo: rate.effectiveTo?.toISOString() ?? null,
    };
  }
}
