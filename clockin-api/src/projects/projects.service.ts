import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Project } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthMembership } from '../auth/auth.types';
import { scopeFor } from '../auth/permissions';
import { VisibilityService } from '../auth/visibility.service';
import {
  buildPaginatedResult,
  PaginatedResult,
  resolvePagination,
} from '../common/pagination';
import { mapPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  PROJECT_DETAIL_INCLUDE,
  type ProjectWithDetail,
} from './project-include';

const ENTITY_TYPE = 'project';
const PROJECT_MEMBER_ENTITY = 'project_member';

const projectMemberInclude = {
  membership: {
    select: {
      id: true,
      status: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  },
} as const;

export type ProjectMemberResponse = {
  id: string;
  projectId: string;
  membershipId: string;
  roleOnProject: string;
  status: string;
  addedAt: Date;
  membership: {
    id: string;
    status: string;
    user: { id: string; email: string; name: string | null };
  };
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  async create(
    organisationId: string,
    membership: AuthMembership,
    dto: CreateProjectDto,
  ): Promise<ProjectWithDetail> {
    const ownerId = dto.ownerId ?? membership.id;
    this.visibility.assertCanCreateProject(membership, ownerId);

    await this.assertClientInOrg(organisationId, dto.clientId);

    if (dto.ownerId) {
      await this.assertOwnerInOrg(organisationId, dto.ownerId);
    }

    // FIX 5 — custom billableByDefault requires billable:set (new project counts as managed by owner)
    let billableByDefault = dto.billableByDefault ?? true;
    const billableScope = scopeFor(membership.permissions, 'billable', 'set');
    if (dto.billableByDefault !== undefined && !billableScope) {
      throw new ForbiddenException(
        'You cannot change billable settings',
      );
    }
    if (!billableScope) {
      billableByDefault = true;
    }

    try {
      const project = await this.prisma.project.create({
        data: {
          organisationId,
          clientId: dto.clientId,
          name: dto.name,
          code: dto.code,
          ownerId,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          status: dto.status ?? 'active',
          budgetHours:
            dto.budgetHours === undefined
              ? undefined
              : new Prisma.Decimal(dto.budgetHours),
          budgetValue:
            dto.budgetValue === undefined
              ? undefined
              : new Prisma.Decimal(dto.budgetValue),
          billableByDefault,
          color: dto.color,
        },
        include: PROJECT_DETAIL_INCLUDE,
      });

      // STEP 1 — project owner is always on the project team as lead
      await this.ensureProjectMember(
        organisationId,
        project.id,
        ownerId,
        'lead',
      );

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTITY_TYPE,
        entityId: project.id,
        action: 'create',
        oldValue: null,
        newValue: this.toAuditJson(project),
      });

      return project;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      mapPrismaError(error);
    }
  }

  async findAll(
    organisationId: string,
    membership: AuthMembership,
    query: ListProjectsQueryDto,
  ): Promise<PaginatedResult<ProjectWithDetail>> {
    const { page, pageSize, skip, take } = resolvePagination(query);

    if (query.clientId) {
      await this.assertClientInOrg(organisationId, query.clientId);
    }

    const visibilityWhere = await this.visibility.projectWhere(
      organisationId,
      membership,
    );

    const where: Prisma.ProjectWhereInput = {
      organisationId,
      ...visibilityWhere,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
    };

    try {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.project.findMany({
          where,
          include: PROJECT_DETAIL_INCLUDE,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        this.prisma.project.count({ where }),
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
  ): Promise<ProjectWithDetail> {
    const visibilityWhere = await this.visibility.projectWhere(
      organisationId,
      membership,
    );
    const project = await this.prisma.project.findFirst({
      where: { id, organisationId, ...visibilityWhere },
      include: PROJECT_DETAIL_INCLUDE,
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(
    organisationId: string,
    membership: AuthMembership,
    id: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectWithDetail> {
    const existing = await this.findOwnedOrThrow(organisationId, id);
    await this.visibility.assertCanEditProject(
      organisationId,
      membership,
      id,
    );

    if (dto.clientId) {
      await this.assertClientInOrg(organisationId, dto.clientId);
    }
    if (dto.ownerId) {
      await this.assertOwnerInOrg(organisationId, dto.ownerId);
    }
    if (dto.billableByDefault !== undefined) {
      await this.visibility.assertCanSetBillable(
        organisationId,
        membership,
        id,
      );
    }

    try {
      const result = await this.prisma.project.updateMany({
        where: { id: existing.id, organisationId },
        data: {
          ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
          ...(dto.startDate !== undefined
            ? {
                startDate:
                  dto.startDate === null ? null : new Date(dto.startDate),
              }
            : {}),
          ...(dto.endDate !== undefined
            ? {
                endDate: dto.endDate === null ? null : new Date(dto.endDate),
              }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.budgetHours !== undefined
            ? {
                budgetHours:
                  dto.budgetHours === null
                    ? null
                    : new Prisma.Decimal(dto.budgetHours),
              }
            : {}),
          ...(dto.budgetValue !== undefined
            ? {
                budgetValue:
                  dto.budgetValue === null
                    ? null
                    : new Prisma.Decimal(dto.budgetValue),
              }
            : {}),
          ...(dto.billableByDefault !== undefined
            ? { billableByDefault: dto.billableByDefault }
            : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Project not found');
      }

      const project = await this.findOwnedOrThrow(organisationId, id);

      // Keep owner on the project team as lead when owner changes
      if (dto.ownerId) {
        await this.ensureProjectMember(
          organisationId,
          project.id,
          dto.ownerId,
          'lead',
        );
      }

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTITY_TYPE,
        entityId: project.id,
        action: 'update',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(project),
      });

      return project;
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
  ): Promise<ProjectWithDetail> {
    const existing = await this.findOwnedOrThrow(organisationId, id);
    await this.visibility.assertCanEditProject(
      organisationId,
      membership,
      id,
    );

    if (existing.status === 'archived') {
      return existing;
    }

    try {
      const result = await this.prisma.project.updateMany({
        where: { id: existing.id, organisationId },
        data: { status: 'archived' },
      });

      if (result.count === 0) {
        throw new NotFoundException('Project not found');
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

  /**
   * STEP 1 — list active project team members (visibility: can view the project).
   */
  async listMembers(
    organisationId: string,
    membership: AuthMembership,
    projectId: string,
  ): Promise<ProjectMemberResponse[]> {
    await this.findOne(organisationId, membership, projectId);

    const rows = await this.prisma.projectMember.findMany({
      where: {
        organisationId,
        projectId,
        status: 'active',
      },
      include: projectMemberInclude,
      orderBy: [{ roleOnProject: 'desc' }, { addedAt: 'asc' }],
    });

    return rows.map((row) => this.toMemberResponse(row));
  }

  async addMember(
    organisationId: string,
    actor: AuthMembership,
    projectId: string,
    dto: AddProjectMemberDto,
  ): Promise<ProjectMemberResponse> {
    await this.findOwnedOrThrow(organisationId, projectId);
    await this.visibility.assertCanEditProject(
      organisationId,
      actor,
      projectId,
    );
    await this.assertOwnerInOrg(organisationId, dto.membershipId);

    const roleOnProject = dto.roleOnProject ?? 'contributor';

    try {
      const row = await this.ensureProjectMember(
        organisationId,
        projectId,
        dto.membershipId,
        roleOnProject,
      );

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: actor.id,
        entityType: PROJECT_MEMBER_ENTITY,
        entityId: row.id,
        action: 'create',
        oldValue: null,
        newValue: {
          projectId,
          membershipId: dto.membershipId,
          roleOnProject,
          status: 'active',
        },
      });

      const full = await this.prisma.projectMember.findFirstOrThrow({
        where: { id: row.id },
        include: projectMemberInclude,
      });
      return this.toMemberResponse(full);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async removeMember(
    organisationId: string,
    actor: AuthMembership,
    projectId: string,
    membershipId: string,
  ): Promise<{ projectId: string; membershipId: string; status: 'removed' }> {
    await this.findOwnedOrThrow(organisationId, projectId);
    await this.visibility.assertCanEditProject(
      organisationId,
      actor,
      projectId,
    );

    const existing = await this.prisma.projectMember.findFirst({
      where: {
        organisationId,
        projectId,
        membershipId,
        status: 'active',
      },
    });
    if (!existing) {
      throw new NotFoundException('Project member not found');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organisationId },
      select: { ownerId: true },
    });
    if (project?.ownerId === membershipId) {
      throw new BadRequestException(
        'Cannot remove the project manager from the team — change the project owner first',
      );
    }

    const openOrDoneTasks = await this.prisma.task.count({
      where: {
        organisationId,
        projectId,
        assigneeId: membershipId,
        status: { in: ['open', 'done'] },
      },
    });
    if (openOrDoneTasks > 0) {
      throw new BadRequestException(
        'Cannot remove this person while they have open or done tasks on the project — reassign or archive those tasks first',
      );
    }

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organisationId },
      select: { userId: true },
    });
    if (membership) {
      const timeOnProject = await this.prisma.timeLine.count({
        where: {
          organisationId,
          projectId,
          timeEntry: { userId: membership.userId },
        },
      });
      if (timeOnProject > 0) {
        throw new BadRequestException(
          'Cannot remove this person while they have logged time on the project',
        );
      }
    }

    try {
      await this.prisma.projectMember.update({
        where: { id: existing.id },
        data: { status: 'removed' },
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: actor.id,
        entityType: PROJECT_MEMBER_ENTITY,
        entityId: existing.id,
        action: 'delete',
        oldValue: {
          projectId,
          membershipId,
          roleOnProject: existing.roleOnProject,
          status: 'active',
        },
        newValue: { status: 'removed' },
      });

      return { projectId, membershipId, status: 'removed' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  /** Upsert active project member (reactivates if previously removed). */
  private async ensureProjectMember(
    organisationId: string,
    projectId: string,
    membershipId: string,
    roleOnProject: 'contributor' | 'lead',
  ): Promise<{ id: string }> {
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_membershipId: { projectId, membershipId },
      },
    });

    if (existing) {
      const updated = await this.prisma.projectMember.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          roleOnProject:
            roleOnProject === 'lead' || existing.roleOnProject === 'lead'
              ? 'lead'
              : roleOnProject,
          organisationId,
        },
        select: { id: true },
      });
      return updated;
    }

    return this.prisma.projectMember.create({
      data: {
        organisationId,
        projectId,
        membershipId,
        roleOnProject,
        status: 'active',
      },
      select: { id: true },
    });
  }

  private toMemberResponse(row: {
    id: string;
    projectId: string;
    membershipId: string;
    roleOnProject: string;
    status: string;
    addedAt: Date;
    membership: {
      id: string;
      status: string;
      user: { id: string; email: string; name: string | null };
    };
  }): ProjectMemberResponse {
    return {
      id: row.id,
      projectId: row.projectId,
      membershipId: row.membershipId,
      roleOnProject: row.roleOnProject,
      status: row.status,
      addedAt: row.addedAt,
      membership: row.membership,
    };
  }

  private async findOwnedOrThrow(
    organisationId: string,
    id: string,
  ): Promise<ProjectWithDetail> {
    const project = await this.prisma.project.findFirst({
      where: { id, organisationId },
      include: PROJECT_DETAIL_INCLUDE,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async assertClientInOrg(
    organisationId: string,
    clientId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organisationId },
      select: { id: true },
    });

    if (!client) {
      throw new BadRequestException(
        'clientId must belong to your organisation',
      );
    }
  }

  private async assertOwnerInOrg(
    organisationId: string,
    ownerId: string,
  ): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: ownerId,
        organisationId,
        status: 'active',
      },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        'ownerId must be an active membership in your organisation',
      );
    }
  }

  private toAuditJson(
    project: Pick<
      Project,
      | 'id'
      | 'organisationId'
      | 'clientId'
      | 'name'
      | 'code'
      | 'ownerId'
      | 'startDate'
      | 'endDate'
      | 'status'
      | 'budgetHours'
      | 'budgetValue'
      | 'billableByDefault'
      | 'color'
    >,
  ): Prisma.InputJsonValue {
    return {
      id: project.id,
      organisationId: project.organisationId,
      clientId: project.clientId,
      name: project.name,
      code: project.code,
      ownerId: project.ownerId,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      status: project.status,
      budgetHours: project.budgetHours?.toString() ?? null,
      budgetValue: project.budgetValue?.toString() ?? null,
      billableByDefault: project.billableByDefault,
      color: project.color,
    };
  }
}
