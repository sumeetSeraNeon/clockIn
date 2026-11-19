import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthMembership } from '../auth/auth.types';
import { highestRoleName } from '../auth/permissions';
import { VisibilityService } from '../auth/visibility.service';
import { mapPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertLeaveDto } from './dto/upsert-leave.dto';
import { UpsertUtilisationMonthDto } from './dto/upsert-utilisation-month.dto';

const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

@Injectable()
export class UtilisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
  ) {}

  assertYearMonth(yearMonth: string): void {
    if (!YEAR_MONTH_RE.test(yearMonth)) {
      throw new BadRequestException('yearMonth must be YYYY-MM');
    }
    const month = Number(yearMonth.slice(5, 7));
    if (month < 1 || month > 12) {
      throw new BadRequestException('yearMonth month must be 01–12');
    }
  }

  private assertOwnerOrAdmin(membership: AuthMembership): void {
    const role = highestRoleName(membership.roles.map((r) => r.name));
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenException(
        'Only owners and admins can manage monthly capacity',
      );
    }
  }

  /** leaveDays must be a non-negative multiple of 0.5 */
  private assertLeaveDays(leaveDays: number): void {
    if (!Number.isFinite(leaveDays) || leaveDays < 0) {
      throw new BadRequestException('leaveDays must be >= 0');
    }
    const doubled = leaveDays * 2;
    if (Math.abs(doubled - Math.round(doubled)) > 1e-9) {
      throw new BadRequestException('leaveDays must be a multiple of 0.5');
    }
  }

  async listMonths(organisationId: string, membership: AuthMembership) {
    this.assertOwnerOrAdmin(membership);
    const rows = await this.prisma.utilisationMonth.findMany({
      where: { organisationId },
      orderBy: { yearMonth: 'desc' },
      take: 12,
      select: { yearMonth: true, plannedHours: true },
    });
    return rows.map((r) => ({
      yearMonth: r.yearMonth,
      plannedHours: Number(r.plannedHours),
    }));
  }

  async getMonth(
    organisationId: string,
    membership: AuthMembership,
    yearMonth: string,
  ) {
    this.assertOwnerOrAdmin(membership);
    this.assertYearMonth(yearMonth);
    const row = await this.prisma.utilisationMonth.findUnique({
      where: {
        organisationId_yearMonth: { organisationId, yearMonth },
      },
    });
    if (!row) {
      return { yearMonth, plannedHours: null };
    }
    return {
      yearMonth: row.yearMonth,
      plannedHours: Number(row.plannedHours),
    };
  }

  async upsertMonth(
    organisationId: string,
    membership: AuthMembership,
    yearMonth: string,
    dto: UpsertUtilisationMonthDto,
  ) {
    this.assertOwnerOrAdmin(membership);
    this.assertYearMonth(yearMonth);
    if (!Number.isFinite(dto.plannedHours) || dto.plannedHours < 0) {
      throw new BadRequestException('plannedHours must be >= 0');
    }

    try {
      const row = await this.prisma.utilisationMonth.upsert({
        where: {
          organisationId_yearMonth: { organisationId, yearMonth },
        },
        create: {
          organisationId,
          yearMonth,
          plannedHours: new Prisma.Decimal(dto.plannedHours),
        },
        update: {
          plannedHours: new Prisma.Decimal(dto.plannedHours),
        },
      });
      return {
        yearMonth: row.yearMonth,
        plannedHours: Number(row.plannedHours),
      };
    } catch (e) {
      throw mapPrismaError(e);
    }
  }

  async listLeave(
    organisationId: string,
    membership: AuthMembership,
    yearMonth: string,
  ) {
    this.assertYearMonth(yearMonth);
    const vis = await this.visibility.membershipWhere(
      organisationId,
      membership,
    );
    const memberships = await this.prisma.membership.findMany({
      where: {
        organisationId,
        status: 'active',
        ...vis,
      },
      select: { userId: true },
    });
    const userIds = [...new Set(memberships.map((m) => m.userId))];
    if (userIds.length === 0) {
      return { yearMonth, entries: [] as Array<{
        userId: string;
        leaveDays: number;
        note: string | null;
      }> };
    }

    const rows = await this.prisma.leaveEntry.findMany({
      where: {
        organisationId,
        yearMonth,
        userId: { in: userIds },
      },
      select: {
        userId: true,
        leaveDays: true,
        note: true,
      },
    });

    return {
      yearMonth,
      entries: rows.map((r) => ({
        userId: r.userId,
        leaveDays: Number(r.leaveDays),
        note: r.note,
      })),
    };
  }

  async upsertLeave(
    organisationId: string,
    membership: AuthMembership,
    targetUserId: string,
    yearMonth: string,
    dto: UpsertLeaveDto,
  ) {
    this.assertYearMonth(yearMonth);
    this.assertLeaveDays(dto.leaveDays);

    const role = highestRoleName(membership.roles.map((r) => r.name));
    const isAdmin = role === 'owner' || role === 'admin';
    const isTeamManager = role === 'team_manager';

    if (!isAdmin && !isTeamManager) {
      throw new ForbiddenException(
        'Only owners, admins, and team managers can edit leave',
      );
    }

    const targetMembership = await this.prisma.membership.findFirst({
      where: {
        organisationId,
        userId: targetUserId,
        status: 'active',
      },
      select: { id: true, managerId: true },
    });
    if (!targetMembership) {
      throw new NotFoundException('Active member not found');
    }

    if (!isAdmin) {
      if (targetMembership.managerId !== membership.id) {
        throw new ForbiddenException(
          'Team managers can only edit leave for their direct reports',
        );
      }
    }

    try {
      if (dto.leaveDays === 0 && !dto.note) {
        await this.prisma.leaveEntry.deleteMany({
          where: {
            organisationId,
            userId: targetUserId,
            yearMonth,
          },
        });
        return {
          userId: targetUserId,
          yearMonth,
          leaveDays: 0,
          note: null as string | null,
        };
      }

      const row = await this.prisma.leaveEntry.upsert({
        where: {
          organisationId_userId_yearMonth: {
            organisationId,
            userId: targetUserId,
            yearMonth,
          },
        },
        create: {
          organisationId,
          userId: targetUserId,
          yearMonth,
          leaveDays: new Prisma.Decimal(dto.leaveDays),
          note: dto.note ?? null,
        },
        update: {
          leaveDays: new Prisma.Decimal(dto.leaveDays),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
      });
      return {
        userId: row.userId,
        yearMonth: row.yearMonth,
        leaveDays: Number(row.leaveDays),
        note: row.note,
      };
    } catch (e) {
      throw mapPrismaError(e);
    }
  }
}
