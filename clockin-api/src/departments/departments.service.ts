import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthMembership } from '../auth/auth.types';
import { can, scopeFor } from '../auth/permissions';
import { VisibilityService } from '../auth/visibility.service';
import { mapPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddDepartmentMemberDto,
  CreateDepartmentDto,
  DepartmentRosterQueryDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

const ENTITY_TYPE = 'department';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private assertCanList(membership: AuthMembership) {
    if (
      !can(membership.permissions, 'member', 'view') &&
      !can(membership.permissions, 'report', 'view')
    ) {
      throw new ForbiddenException(
        'Missing permission member:view or report:view',
      );
    }
  }

  /** People this caller may see inside a department. */
  private async visibleMembershipWhere(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<Prisma.MembershipWhereInput> {
    if (can(membership.permissions, 'member', 'view')) {
      return this.visibility.membershipWhere(organisationId, membership);
    }
    const reportScope = scopeFor(membership.permissions, 'report', 'view');
    if (reportScope === 'all') return {};
    const ids = await this.visibility.managedMembershipIds(
      organisationId,
      membership.id,
    );
    return { id: { in: ids } };
  }

  async findAll(
    organisationId: string,
    membership: AuthMembership,
    query: ListDepartmentsQueryDto,
  ) {
    this.assertCanList(membership);
    const peopleWhere = await this.visibleMembershipWhere(
      organisationId,
      membership,
    );
    const q = query.q?.trim();
    const where: Prisma.DepartmentWhereInput = {
      organisationId,
      ...(query.status ? { status: query.status } : { status: 'active' }),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };

    try {
      const rows = await this.prisma.department.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          members: {
            where: {
              membership: { organisationId, status: 'active', ...peopleWhere },
            },
            select: { id: true },
          },
        },
      });

      return {
        data: rows.map((row) => ({
          id: row.id,
          organisationId: row.organisationId,
          name: row.name,
          status: row.status,
          memberCount: row.members.length,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
      };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findOne(organisationId: string, membership: AuthMembership, id: string) {
    this.assertCanList(membership);
    const department = await this.findOwnedOrThrow(organisationId, id);
    const peopleWhere = await this.visibleMembershipWhere(
      organisationId,
      membership,
    );
    const links = await this.prisma.departmentMember.findMany({
      where: {
        organisationId,
        departmentId: id,
        membership: { organisationId, ...peopleWhere },
      },
      include: {
        membership: {
          include: {
            user: { select: { id: true, email: true, name: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      id: department.id,
      organisationId: department.organisationId,
      name: department.name,
      status: department.status,
      members: links.map((link) => ({
        membershipId: link.membershipId,
        status: link.membership.status,
        user: link.membership.user,
      })),
    };
  }

  async create(
    organisationId: string,
    actor: AuthMembership,
    dto: CreateDepartmentDto,
  ) {
    const name = dto.name.trim();
    await this.assertNameAvailable(organisationId, name);
    try {
      const created = await this.prisma.department.create({
        data: { organisationId, name, status: 'active' },
      });
      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: actor.id,
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: 'create',
        newValue: { name: created.name, status: created.status },
      });
      return created;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(
    organisationId: string,
    actor: AuthMembership,
    id: string,
    dto: UpdateDepartmentDto,
  ) {
    const existing = await this.findOwnedOrThrow(organisationId, id);
    const name = dto.name?.trim();
    if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameAvailable(organisationId, name, id);
    }
    try {
      const updated = await this.prisma.department.update({
        where: { id: existing.id },
        data: {
          ...(name ? { name } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
      });
      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: actor.id,
        entityType: ENTITY_TYPE,
        entityId: updated.id,
        action: dto.status === 'archived' ? 'archive' : 'update',
        oldValue: { name: existing.name, status: existing.status },
        newValue: { name: updated.name, status: updated.status },
      });
      return updated;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async addMember(
    organisationId: string,
    actor: AuthMembership,
    departmentId: string,
    dto: AddDepartmentMemberDto,
  ) {
    const department = await this.findOwnedOrThrow(organisationId, departmentId);
    if (department.status !== 'active') {
      throw new BadRequestException('Archived departments cannot take new people');
    }
    const person = await this.prisma.membership.findFirst({
      where: {
        id: dto.membershipId,
        organisationId,
        status: 'active',
      },
      select: { id: true },
    });
    if (!person) {
      throw new BadRequestException(
        'membershipId must be an active membership in your organisation',
      );
    }
    try {
      const link = await this.prisma.departmentMember.upsert({
        where: {
          departmentId_membershipId: {
            departmentId,
            membershipId: dto.membershipId,
          },
        },
        update: {},
        create: {
          organisationId,
          departmentId,
          membershipId: dto.membershipId,
        },
      });
      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: actor.id,
        entityType: ENTITY_TYPE,
        entityId: departmentId,
        action: 'update',
        newValue: { addedMembershipId: dto.membershipId, linkId: link.id },
      });
      return { id: link.id, departmentId, membershipId: dto.membershipId };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async removeMember(
    organisationId: string,
    actor: AuthMembership,
    departmentId: string,
    membershipId: string,
  ) {
    await this.findOwnedOrThrow(organisationId, departmentId);
    const link = await this.prisma.departmentMember.findFirst({
      where: { organisationId, departmentId, membershipId },
    });
    if (!link) {
      throw new NotFoundException('That person is not in this department');
    }
    await this.prisma.departmentMember.delete({ where: { id: link.id } });
    await this.audit.writeAudit({
      organisationId,
      actorMembershipId: actor.id,
      entityType: ENTITY_TYPE,
      entityId: departmentId,
      action: 'update',
      oldValue: { removedMembershipId: membershipId },
    });
    return { removed: true };
  }

  async roster(
    organisationId: string,
    membership: AuthMembership,
    departmentId: string,
    query: DepartmentRosterQueryDto,
  ) {
    if (!can(membership.permissions, 'report', 'view')) {
      throw new ForbiddenException('Missing permission report:view');
    }
    if (query.dateFrom > query.dateTo) {
      throw new BadRequestException('dateFrom must be on or before dateTo');
    }
    const department = await this.findOwnedOrThrow(organisationId, departmentId);
    const peopleWhere = await this.visibleMembershipWhere(
      organisationId,
      membership,
    );

    const links = await this.prisma.departmentMember.findMany({
      where: {
        organisationId,
        departmentId,
        membership: { organisationId, status: 'active', ...peopleWhere },
      },
      include: {
        membership: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            projectMemberships: {
              where: { organisationId, status: 'active' },
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                    client: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const userIds = links.map((link) => link.membership.userId);
    const hoursByUserProject = await this.hoursByUserProject(
      organisationId,
      membership,
      userIds,
      query.dateFrom,
      query.dateTo,
    );

    const projectMap = new Map<
      string,
      { id: string; name: string; clientName: string | null; hours: number }
    >();
    const people = links.map((link) => {
      const projects = link.membership.projectMemberships
        .filter((row) => row.project.status !== 'archived')
        .map((row) => {
          const hours =
            hoursByUserProject.get(
              `${link.membership.userId}:${row.project.id}`,
            ) ?? 0;
          const existing = projectMap.get(row.project.id);
          if (existing) {
            existing.hours += hours;
          } else {
            projectMap.set(row.project.id, {
              id: row.project.id,
              name: row.project.name,
              clientName: row.project.client?.name ?? null,
              hours,
            });
          }
          return {
            id: row.project.id,
            name: row.project.name,
            clientName: row.project.client?.name ?? null,
            hours,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        membershipId: link.membershipId,
        userId: link.membership.userId,
        name: link.membership.user.name,
        email: link.membership.user.email,
        projects,
      };
    });

    people.sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email),
    );

    return {
      department: { id: department.id, name: department.name },
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      projects: [...projectMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      people,
    };
  }

  /** User ids of active people in an active department. Empty if none. */
  async userIdsInDepartment(
    organisationId: string,
    departmentId: string,
  ): Promise<string[]> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organisationId, status: 'active' },
      select: { id: true },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    const rows = await this.prisma.departmentMember.findMany({
      where: {
        organisationId,
        departmentId,
        membership: { organisationId, status: 'active' },
      },
      select: { membership: { select: { userId: true } } },
    });
    return [...new Set(rows.map((row) => row.membership.userId))];
  }

  private async hoursByUserProject(
    organisationId: string,
    membership: AuthMembership,
    userIds: string[],
    dateFrom: string,
    dateTo: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (userIds.length === 0) return map;
    const visibilityWhere = await this.visibility.timeLineReportWhere(
      organisationId,
      membership,
      membership.userId,
    );
    const lines = await this.prisma.timeLine.findMany({
      where: {
        organisationId,
        AND: [
          visibilityWhere,
          {
            timeEntry: {
              organisationId,
              status: 'approved',
              userId: { in: userIds },
              entryDate: {
                gte: new Date(dateFrom),
                lte: new Date(dateTo),
              },
            },
          },
        ],
      },
      select: {
        projectId: true,
        durationMinutes: true,
        timeEntry: { select: { userId: true } },
      },
    });
    for (const line of lines) {
      if (!line.projectId) continue;
      const key = `${line.timeEntry.userId}:${line.projectId}`;
      map.set(key, (map.get(key) ?? 0) + line.durationMinutes / 60);
    }
    return map;
  }

  private async findOwnedOrThrow(organisationId: string, id: string) {
    const row = await this.prisma.department.findFirst({
      where: { id, organisationId },
    });
    if (!row) throw new NotFoundException('Department not found');
    return row;
  }

  private async assertNameAvailable(
    organisationId: string,
    name: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.department.findFirst({
      where: {
        organisationId,
        name: { equals: name, mode: 'insensitive' },
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'A department with that name already exists',
      );
    }
  }
}
