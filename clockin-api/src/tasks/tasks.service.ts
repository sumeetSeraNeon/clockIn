import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Task } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthMembership } from '../auth/auth.types';
import { VisibilityService } from '../auth/visibility.service';
import {
  buildPaginatedResult,
  PaginatedResult,
  resolvePagination,
} from '../common/pagination';
import { mapPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  TASK_DETAIL_INCLUDE,
  type TaskWithDetail,
} from './task-include';

const ENTITY_TYPE = 'task';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  async create(
    organisationId: string,
    membership: AuthMembership,
    dto: CreateTaskDto,
  ): Promise<TaskWithDetail> {
    await this.assertProjectInOrg(organisationId, dto.projectId);
    await this.visibility.assertCanEditTaskOnProject(
      organisationId,
      membership,
      dto.projectId,
    );

    if (dto.assigneeId) {
      await this.assertMembershipInOrg(organisationId, dto.assigneeId);
      await this.assertAssigneeIsProjectMember(
        organisationId,
        dto.projectId,
        dto.assigneeId,
      );
    }

    // FIX 5 — inherit from project unless billable:set allows override
    let billable: boolean;
    if (dto.billable !== undefined) {
      await this.visibility.assertCanSetBillable(
        organisationId,
        membership,
        dto.projectId,
      );
      billable = dto.billable;
    } else {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organisationId },
        select: { billableByDefault: true },
      });
      billable = project?.billableByDefault ?? true;
    }

    const status = dto.status ?? 'open';
    await this.assertEstimateWithinBudget(
      organisationId,
      dto.projectId,
      dto.estimatedHours ?? 0,
      status,
    );

    try {
      const task = await this.prisma.task.create({
        data: {
          organisationId,
          projectId: dto.projectId,
          name: dto.name,
          status,
          assigneeId: dto.assigneeId,
          estimatedHours:
            dto.estimatedHours === undefined
              ? undefined
              : new Prisma.Decimal(dto.estimatedHours),
          billable,
        },
        include: TASK_DETAIL_INCLUDE,
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTITY_TYPE,
        entityId: task.id,
        action: 'create',
        oldValue: null,
        newValue: this.toAuditJson(task),
      });

      return task;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async findAll(
    organisationId: string,
    membership: AuthMembership,
    query: ListTasksQueryDto,
  ): Promise<PaginatedResult<TaskWithDetail>> {
    const { page, pageSize, skip, take } = resolvePagination(query);

    if (query.projectId) {
      await this.assertProjectInOrg(organisationId, query.projectId);
    }
    if (query.assigneeId) {
      await this.assertMembershipInOrg(organisationId, query.assigneeId);
    }

    const visibilityWhere = await this.visibility.taskWhere(
      organisationId,
      membership,
    );

    const where: Prisma.TaskWhereInput = {
      organisationId,
      ...visibilityWhere,
      ...(query.status ? { status: query.status } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    };

    try {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.task.findMany({
          where,
          include: TASK_DETAIL_INCLUDE,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        this.prisma.task.count({ where }),
      ]);

      return buildPaginatedResult(data, total, page, pageSize);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findOne(
    organisationId: string,
    membership: AuthMembership,
    id: string,
  ): Promise<TaskWithDetail> {
    const visibilityWhere = await this.visibility.taskWhere(
      organisationId,
      membership,
    );
    const task = await this.prisma.task.findFirst({
      where: { id, organisationId, ...visibilityWhere },
      include: TASK_DETAIL_INCLUDE,
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(
    organisationId: string,
    membership: AuthMembership,
    id: string,
    dto: UpdateTaskDto,
  ): Promise<TaskWithDetail> {
    const existing = await this.findOwnedOrThrow(organisationId, id);
    await this.visibility.assertCanEditTask(organisationId, membership, id);

    if (dto.projectId) {
      await this.assertProjectInOrg(organisationId, dto.projectId);
      await this.visibility.assertCanEditTaskOnProject(
        organisationId,
        membership,
        dto.projectId,
      );
    }
    if (dto.assigneeId) {
      await this.assertMembershipInOrg(organisationId, dto.assigneeId);
      await this.assertAssigneeIsProjectMember(
        organisationId,
        dto.projectId ?? existing.projectId,
        dto.assigneeId,
      );
    }
    if (dto.billable !== undefined) {
      await this.visibility.assertCanSetBillable(
        organisationId,
        membership,
        dto.projectId ?? existing.projectId,
      );
    }

    const nextProjectId = dto.projectId ?? existing.projectId;
    const nextStatus = dto.status ?? existing.status;
    const nextEstimate =
      dto.estimatedHours !== undefined
        ? dto.estimatedHours
        : existing.estimatedHours != null
          ? Number(existing.estimatedHours)
          : 0;

    await this.assertEstimateWithinBudget(
      organisationId,
      nextProjectId,
      nextEstimate ?? 0,
      nextStatus,
      existing.id,
    );

    // If moving to another project with an existing assignee, validate against new project
    const nextAssigneeId =
      dto.assigneeId !== undefined ? dto.assigneeId : existing.assigneeId;
    if (dto.projectId && nextAssigneeId) {
      await this.assertAssigneeIsProjectMember(
        organisationId,
        dto.projectId,
        nextAssigneeId,
      );
    }

    try {
      const result = await this.prisma.task.updateMany({
        where: { id: existing.id, organisationId },
        data: {
          ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.assigneeId !== undefined
            ? { assigneeId: dto.assigneeId }
            : {}),
          ...(dto.estimatedHours !== undefined
            ? {
                estimatedHours:
                  dto.estimatedHours === null
                    ? null
                    : new Prisma.Decimal(dto.estimatedHours),
              }
            : {}),
          ...(dto.billable !== undefined ? { billable: dto.billable } : {}),
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Task not found');
      }

      const task = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTITY_TYPE,
        entityId: task.id,
        action: 'update',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(task),
      });

      return task;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async archive(
    organisationId: string,
    membership: AuthMembership,
    id: string,
  ): Promise<TaskWithDetail> {
    const existing = await this.findOwnedOrThrow(organisationId, id);
    await this.visibility.assertCanEditTask(organisationId, membership, id);

    if (existing.status === 'archived') {
      return existing;
    }

    try {
      const result = await this.prisma.task.updateMany({
        where: { id: existing.id, organisationId },
        data: { status: 'archived' },
      });

      if (result.count === 0) {
        throw new NotFoundException('Task not found');
      }

      const archived = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTITY_TYPE,
        entityId: archived.id,
        action: 'archive',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(archived),
      });

      return archived;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  private async findOwnedOrThrow(
    organisationId: string,
    id: string,
  ): Promise<TaskWithDetail> {
    const task = await this.prisma.task.findFirst({
      where: { id, organisationId },
      include: TASK_DETAIL_INCLUDE,
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private async assertProjectInOrg(
    organisationId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organisationId },
      select: { id: true },
    });

    if (!project) {
      throw new BadRequestException(
        'projectId must belong to your organisation',
      );
    }
  }

  /**
   * Phase2 FIX1 — sum of open/done estimates on a project cannot exceed budgetHours.
   * Archived tasks are excluded. Null budget = unlimited.
   */
  private async assertEstimateWithinBudget(
    organisationId: string,
    projectId: string,
    thisEstimateHours: number,
    thisStatus: string,
    excludeTaskId?: string,
  ): Promise<void> {
    if (thisStatus === 'archived') return;

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organisationId },
      select: { budgetHours: true, name: true },
    });
    if (!project?.budgetHours) return;

    const budget = Number(project.budgetHours);
    if (!Number.isFinite(budget) || budget <= 0) return;

    const others = await this.prisma.task.findMany({
      where: {
        organisationId,
        projectId,
        status: { in: ['open', 'done'] },
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      },
      select: { estimatedHours: true },
    });

    const allocated = others.reduce(
      (sum, t) => sum + (t.estimatedHours != null ? Number(t.estimatedHours) : 0),
      0,
    );
    const thisHours =
      Number.isFinite(thisEstimateHours) && thisEstimateHours > 0
        ? thisEstimateHours
        : 0;
    const total = allocated + thisHours;
    const remaining = Math.max(0, budget - allocated);

    if (total > budget + 1e-9) {
      throw new BadRequestException(
        `Task estimate exceeds project budget for "${project.name}". ` +
          `Budget ${budget}h, already allocated ${allocated}h, remaining ${remaining}h, this task ${thisHours}h.`,
      );
    }
  }

  private async assertMembershipInOrg(
    organisationId: string,
    membershipId: string,
  ): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        organisationId,
        status: 'active',
      },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        'assigneeId must be an active membership in your organisation',
      );
    }
  }

  /** STEP 1 — task assignee must already be on the project team. */
  private async assertAssigneeIsProjectMember(
    organisationId: string,
    projectId: string,
    membershipId: string,
  ): Promise<void> {
    const ok = await this.visibility.isProjectMember(
      organisationId,
      projectId,
      membershipId,
    );
    if (!ok) {
      throw new BadRequestException(
        'Assignee must be a member of this project — add them on the project Team first',
      );
    }
  }

  private toAuditJson(
    task: Pick<
      Task,
      | 'id'
      | 'organisationId'
      | 'projectId'
      | 'name'
      | 'status'
      | 'assigneeId'
      | 'estimatedHours'
      | 'billable'
    >,
  ): Prisma.InputJsonValue {
    return {
      id: task.id,
      organisationId: task.organisationId,
      projectId: task.projectId,
      name: task.name,
      status: task.status,
      assigneeId: task.assigneeId,
      estimatedHours: task.estimatedHours?.toString() ?? null,
      billable: task.billable,
    };
  }
}
