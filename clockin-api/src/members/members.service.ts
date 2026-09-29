import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthMembership } from '../auth/auth.types';
import { VisibilityService } from '../auth/visibility.service';
import {
  buildPaginatedResult,
  PaginatedResult,
  resolvePagination,
} from '../common/pagination';
import { mapPrismaError } from '../common/prisma-errors';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateMemberRolesDto } from './dto/update-member-roles.dto';

const ENTITY_TYPE = 'membership';

const memberInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      authProvider: true,
      firebaseUid: true,
    },
  },
  membershipRoles: {
    include: {
      role: { select: { id: true, name: true, isSystem: true } },
    },
  },
} satisfies Prisma.MembershipInclude;

type MemberRecord = Prisma.MembershipGetPayload<{
  include: typeof memberInclude;
}>;

export type MemberResponse = {
  id: string;
  organisationId: string;
  userId: string;
  memberType: string;
  department: string | null;
  managerId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user: MemberRecord['user'];
  roles: { id: string; name: string; isSystem: boolean }[];
  /** Present after invite when Firebase Admin could create/reset the account. */
  passwordResetLink?: string | null;
  /** Phase2 FIX6 — true when invite email was sent via SMTP. */
  inviteEmailSent?: boolean;
};

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly firebase: FirebaseService,
    private readonly visibility: VisibilityService,
    private readonly mail: MailService,
  ) {}

  async findAll(
    organisationId: string,
    membership: AuthMembership,
    query: ListMembersQueryDto,
  ): Promise<PaginatedResult<MemberResponse>> {
    const { page, pageSize, skip, take } = resolvePagination(query);

    const visibilityWhere = await this.visibility.membershipWhere(
      organisationId,
      membership,
    );

    const where: Prisma.MembershipWhereInput = {
      organisationId,
      ...visibilityWhere,
      ...(query.status ? { status: query.status } : {}),
    };

    try {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.membership.findMany({
          where,
          include: memberInclude,
          orderBy: { createdAt: 'asc' },
          skip,
          take,
        }),
        this.prisma.membership.count({ where }),
      ]);

      return buildPaginatedResult(
        rows.map((row) => this.toResponse(row)),
        total,
        page,
        pageSize,
      );
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async invite(
    organisationId: string,
    actorMembershipId: string,
    dto: InviteMemberDto,
  ): Promise<MemberResponse> {
    const email = dto.email.trim().toLowerCase();

    if (dto.managerId) {
      await this.assertMembershipInOrg(organisationId, dto.managerId);
    }
    if (dto.roleIds?.length) {
      await this.assertRolesInOrg(organisationId, dto.roleIds);
    }

    let passwordResetLink: string | null = null;
    let firebaseUid: string | null = null;
    try {
      const ensured = await this.firebase.ensureAuthUser(email, dto.name);
      firebaseUid = ensured.uid;
      passwordResetLink = ensured.passwordResetLink;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Invite Firebase user for ${email} failed (DB invite continues): ${message}`,
      );
    }

    try {
      const member = await this.prisma.$transaction(async (tx) => {
        let user = await tx.user.findUnique({ where: { email } });

        if (!user) {
          user = await tx.user.create({
            data: {
              email,
              name: dto.name,
              status: 'invited',
              authProvider: firebaseUid ? 'firebase' : null,
              firebaseUid,
            },
          });
        } else if (firebaseUid && !user.firebaseUid) {
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              firebaseUid,
              authProvider: 'firebase',
            },
          });
        }

        const existingMembership = await tx.membership.findUnique({
          where: {
            organisationId_userId: {
              organisationId,
              userId: user.id,
            },
          },
        });

        if (existingMembership) {
          if (existingMembership.status === 'pending') {
            await tx.membership.update({
              where: { id: existingMembership.id },
              data: {
                status: 'active',
                memberType: dto.memberType ?? existingMembership.memberType,
                department:
                  dto.department !== undefined
                    ? dto.department
                    : existingMembership.department,
                managerId:
                  dto.managerId !== undefined
                    ? dto.managerId
                    : existingMembership.managerId,
              },
            });

            if (dto.roleIds?.length) {
              for (const roleId of dto.roleIds) {
                await tx.membershipRole.upsert({
                  where: {
                    membershipId_roleId: {
                      membershipId: existingMembership.id,
                      roleId,
                    },
                  },
                  update: {},
                  create: {
                    membershipId: existingMembership.id,
                    roleId,
                  },
                });
              }
            }

            return tx.membership.findFirstOrThrow({
              where: { id: existingMembership.id },
              include: memberInclude,
            });
          }
          throw new BadRequestException(
            'This email already has a membership in your organisation',
          );
        }

        const created = await tx.membership.create({
          data: {
            organisationId,
            userId: user.id,
            memberType: dto.memberType ?? 'staff',
            department: dto.department,
            managerId: dto.managerId,
            status: 'active',
            ...(dto.roleIds?.length
              ? {
                  membershipRoles: {
                    create: dto.roleIds.map((roleId) => ({ roleId })),
                  },
                }
              : {}),
          },
          include: memberInclude,
        });

        return created;
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: member.id,
        action: 'invite',
        oldValue: null,
        newValue: this.toAuditJson(member),
      });

      let inviteEmailSent = false;
      if (passwordResetLink) {
        const org = await this.prisma.organisation.findFirst({
          where: { id: organisationId },
          select: { name: true },
        });
        const actor = await this.prisma.membership.findFirst({
          where: { id: actorMembershipId },
          select: { user: { select: { name: true, email: true } } },
        });
        inviteEmailSent = await this.mail.sendInviteEmail({
          to: email,
          inviteeName: dto.name,
          organisationName: org?.name ?? 'your organisation',
          inviterName: actor?.user.name || actor?.user.email || null,
          passwordResetLink,
        });
      }

      return {
        ...this.toResponse(member),
        passwordResetLink: inviteEmailSent ? null : passwordResetLink,
        inviteEmailSent,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async approve(
    organisationId: string,
    actorMembershipId: string,
    id: string,
  ): Promise<MemberResponse> {
    const existing = await this.findOwnedOrThrow(organisationId, id);

    if (existing.status === 'active' && existing.user.status === 'active') {
      return this.toResponse(existing);
    }

    if (existing.status !== 'pending' && existing.status !== 'active') {
      throw new BadRequestException(
        'Only pending (or already-active) memberships can be approved',
      );
    }

    try {
      const employeeRole = await this.prisma.role.findFirst({
        where: { organisationId, name: 'member' },
        select: { id: true },
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.membership.update({
          where: { id: existing.id },
          data: { status: 'active' },
        });

        await tx.user.update({
          where: { id: existing.userId },
          data: { status: 'active' },
        });

        if (employeeRole && existing.membershipRoles.length === 0) {
          await tx.membershipRole.create({
            data: {
              membershipId: existing.id,
              roleId: employeeRole.id,
            },
          });
        }
      });

      const updated = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: updated.id,
        action: 'approve',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(updated),
      });

      return this.toResponse(updated);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async update(
    organisationId: string,
    actorMembershipId: string,
    id: string,
    dto: UpdateMemberDto,
  ): Promise<MemberResponse> {
    const existing = await this.findOwnedOrThrow(organisationId, id);

    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestException('A member cannot be their own manager');
      }
      await this.assertMembershipInOrg(organisationId, dto.managerId);
    }

    if (
      dto.status === 'deactivated' &&
      actorMembershipId === id
    ) {
      throw new BadRequestException('You cannot deactivate your own membership');
    }

    try {
      const result = await this.prisma.membership.updateMany({
        where: { id: existing.id, organisationId },
        data: {
          ...(dto.department !== undefined
            ? { department: dto.department }
            : {}),
          ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Member not found');
      }

      const updated = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: updated.id,
        action: 'update',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(updated),
      });

      return this.toResponse(updated);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async updateRoles(
    organisationId: string,
    actorMembershipId: string,
    id: string,
    dto: UpdateMemberRolesDto,
  ): Promise<MemberResponse> {
    const addRoleIds = dto.addRoleIds ?? [];
    const removeRoleIds = dto.removeRoleIds ?? [];

    if (addRoleIds.length === 0 && removeRoleIds.length === 0) {
      throw new BadRequestException(
        'Provide addRoleIds and/or removeRoleIds',
      );
    }

    const existing = await this.findOwnedOrThrow(organisationId, id);

    if (addRoleIds.length) {
      await this.assertRolesInOrg(organisationId, addRoleIds);
    }
    if (removeRoleIds.length) {
      await this.assertRolesInOrg(organisationId, removeRoleIds);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (removeRoleIds.length) {
          await tx.membershipRole.deleteMany({
            where: {
              membershipId: existing.id,
              roleId: { in: removeRoleIds },
            },
          });
        }

        for (const roleId of addRoleIds) {
          await tx.membershipRole.upsert({
            where: {
              membershipId_roleId: {
                membershipId: existing.id,
                roleId,
              },
            },
            update: {},
            create: {
              membershipId: existing.id,
              roleId,
            },
          });
        }
      });

      const updated = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: updated.id,
        action: 'update_roles',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(updated),
      });

      return this.toResponse(updated);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async deactivate(
    organisationId: string,
    actorMembershipId: string,
    id: string,
  ): Promise<MemberResponse> {
    if (actorMembershipId === id) {
      throw new BadRequestException('You cannot deactivate your own membership');
    }

    const existing = await this.findOwnedOrThrow(organisationId, id);

    if (existing.status === 'deactivated') {
      return this.toResponse(existing);
    }

    try {
      const result = await this.prisma.membership.updateMany({
        where: { id: existing.id, organisationId },
        data: { status: 'deactivated' },
      });

      if (result.count === 0) {
        throw new NotFoundException('Member not found');
      }

      const updated = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: updated.id,
        action: 'deactivate',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(updated),
      });

      return this.toResponse(updated);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  private async findOwnedOrThrow(
    organisationId: string,
    id: string,
  ): Promise<MemberRecord> {
    const membership = await this.prisma.membership.findFirst({
      where: { id, organisationId },
      include: memberInclude,
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    return membership;
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
        'managerId must be an active membership in your organisation',
      );
    }
  }

  private async assertRolesInOrg(
    organisationId: string,
    roleIds: string[],
  ): Promise<void> {
    const roles = await this.prisma.role.findMany({
      where: {
        organisationId,
        id: { in: roleIds },
      },
      select: { id: true },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException(
        'One or more roleIds do not belong to your organisation',
      );
    }
  }

  private toResponse(row: MemberRecord): MemberResponse {
    return {
      id: row.id,
      organisationId: row.organisationId,
      userId: row.userId,
      memberType: row.memberType,
      department: row.department,
      managerId: row.managerId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: row.user,
      roles: row.membershipRoles.map((mr) => ({
        id: mr.role.id,
        name: mr.role.name,
        isSystem: mr.role.isSystem,
      })),
    };
  }

  private toAuditJson(row: MemberRecord): Prisma.InputJsonValue {
    return {
      id: row.id,
      organisationId: row.organisationId,
      userId: row.userId,
      email: row.user.email,
      memberType: row.memberType,
      department: row.department,
      managerId: row.managerId,
      status: row.status,
      roles: row.membershipRoles.map((mr) => mr.role.name),
    };
  }
}
