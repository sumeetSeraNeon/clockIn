import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, TimesheetPeriod } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthMembership } from '../auth/auth.types';
import { scopeFor } from '../auth/permissions';
import { VisibilityService } from '../auth/visibility.service';
import { PrismaService } from '../prisma/prisma.service';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';

const ENTITY_TYPE = 'timesheet_period';

/** Period statuses that lock member edits. */
export const LOCKED_PERIOD_STATUSES = ['submitted', 'approved', 'locked'] as const;

type PeriodWithApprovals = TimesheetPeriod & {
  approvals: {
    id: string;
    decision: string | null;
    reason: string | null;
    decidedAt: Date | null;
    approverId: string | null;
    createdAt: Date;
  }[];
  user: { id: string; email: string; name: string | null };
};

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly _visibility: VisibilityService,
  ) {}

  /** Get (or describe) the caller's period for a range (day or week). */
  async getMine(
    organisationId: string,
    userId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    this.assertRange(periodStart, periodEnd);
    const start = this.dateOnly(periodStart);
    const end = this.dateOnly(periodEnd);

    const period = await this.prisma.timesheetPeriod.findFirst({
      where: {
        organisationId,
        userId,
        periodStart: start,
        periodEnd: end,
      },
      include: this.periodInclude(),
    });

    const entryStats = await this.entryStats(
      organisationId,
      userId,
      start,
      end,
    );

    const conflictDays = await this.lockedDaysInRange(
      organisationId,
      userId,
      start,
      end,
      period?.id,
    );

    const canSubmitBase =
      (!period ||
        period.status === 'draft' ||
        period.status === 'rejected') &&
      entryStats.entryCount > 0 &&
      entryStats.runningCount === 0;

    return {
      period: period ? this.toResponse(period) : null,
      periodStart,
      periodEnd,
      ...entryStats,
      conflictDays,
      canSubmit: canSubmitBase && conflictDays.length === 0,
      locked: period
        ? (LOCKED_PERIOD_STATUSES as readonly string[]).includes(period.status)
        : false,
    };
  }

  async submit(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    dto: SubmitTimesheetDto,
  ) {
    this.assertRange(dto.periodStart, dto.periodEnd);
    const start = this.dateOnly(dto.periodStart);
    const end = this.dateOnly(dto.periodEnd);

    const stats = await this.entryStats(organisationId, userId, start, end);
    if (stats.runningCount > 0) {
      throw new BadRequestException(
        'Stop running timers before submitting this period',
      );
    }
    if (stats.entryCount === 0) {
      throw new BadRequestException(
        'Log at least one time entry before submitting',
      );
    }

    let period = await this.prisma.timesheetPeriod.findFirst({
      where: {
        organisationId,
        userId,
        periodStart: start,
        periodEnd: end,
      },
    });

    if (period && (LOCKED_PERIOD_STATUSES as readonly string[]).includes(period.status)) {
      throw new BadRequestException(
        `This period is already ${period.status}`,
      );
    }

    const conflictDays = await this.lockedDaysInRange(
      organisationId,
      userId,
      start,
      end,
      period?.id,
    );
    if (conflictDays.length > 0) {
      throw new BadRequestException(
        `Some days are already submitted or approved (${conflictDays.join(', ')}). Submit remaining days separately or wait for unlock.`,
      );
    }

    const oldStatus = period?.status ?? null;

    if (!period) {
      period = await this.prisma.timesheetPeriod.create({
        data: {
          organisationId,
          userId,
          periodStart: start,
          periodEnd: end,
          status: 'submitted',
          submittedAt: new Date(),
        },
      });
    } else {
      period = await this.prisma.timesheetPeriod.update({
        where: { id: period.id },
        data: {
          status: 'submitted',
          submittedAt: new Date(),
        },
      });
    }

    await this.prisma.timeEntry.updateMany({
      where: {
        organisationId,
        userId,
        entryDate: { gte: start, lte: end },
        status: { in: ['draft', 'rejected'] },
      },
      data: { status: 'submitted' },
    });

    await this.prisma.timeLine.updateMany({
      where: {
        organisationId,
        status: { in: ['draft', 'rejected'] },
        timeEntry: {
          userId,
          entryDate: { gte: start, lte: end },
        },
      },
      data: { status: 'submitted' },
    });

    await this.audit.writeAudit({
      organisationId,
      actorMembershipId: membership.id,
      entityType: ENTITY_TYPE,
      entityId: period.id,
      action: 'submit',
      oldValue: oldStatus ? { status: oldStatus } : null,
      newValue: { status: 'submitted', periodStart: dto.periodStart, periodEnd: dto.periodEnd },
    });

    await this.rebuildSlicesForPeriod(
      organisationId,
      period.id,
      userId,
      start,
      end,
    );

    const full = await this.prisma.timesheetPeriod.findFirstOrThrow({
      where: { id: period.id },
      include: this.periodInclude(),
    });
    return this.toResponse(full);
  }

  async listPending(
    organisationId: string,
    membership: AuthMembership,
  ) {
    const scope = scopeFor(membership.permissions, 'timesheet', 'approve');
    if (!scope) {
      throw new ForbiddenException('You cannot approve timesheets');
    }

    const submittedSlices = await this.prisma.timesheetPeriodSlice.findMany({
      where: {
        organisationId,
        status: 'submitted',
        timesheetPeriod: { status: 'submitted' },
      },
      include: {
        project: { select: { id: true, name: true } },
        timesheetPeriod: { include: this.periodInclude() },
      },
      orderBy: [
        { timesheetPeriod: { periodStart: 'desc' } },
        { createdAt: 'desc' },
      ],
    });

    const data = [];
    for (const slice of submittedSlices) {
      const period = slice.timesheetPeriod as PeriodWithApprovals;
      if (
        !(await this.canApproveSlice(organisationId, membership, {
          projectId: slice.projectId,
          userId: period.userId,
        }))
      ) {
        continue;
      }

      const review = await this.buildPeriodReview(
        organisationId,
        period.userId,
        period.periodStart,
        period.periodEnd,
        slice.projectId,
      );
      const managerContext = await this.managerContextForUser(
        organisationId,
        period.userId,
      );
      const periodKind = this.periodKind(
        period.periodStart,
        period.periodEnd,
      );
      const projectName =
        slice.project?.name ??
        (slice.projectId ? 'Project' : 'No project');
      data.push({
        ...this.toResponse(period),
        id: slice.id,
        periodId: period.id,
        sliceId: slice.id,
        projectId: slice.projectId,
        projectName,
        ...review,
        periodKind,
        managerMembershipId: managerContext.managerMembershipId,
        managerName: managerContext.managerName,
      });
    }

    return {
      data,
      total: data.length,
    };
  }

  async approve(
    organisationId: string,
    membership: AuthMembership,
    sliceId: string,
  ) {
    const slice = await this.findSliceOrThrow(organisationId, sliceId);
    const period = slice.timesheetPeriod;
    await this.assertSliceAwaitingDecision(organisationId, slice, period);
    if (period.status !== 'submitted') {
      throw new BadRequestException(
        `Period is not awaiting approval (current: ${period.status})`,
      );
    }
    if (
      !(await this.canApproveSlice(organisationId, membership, {
        projectId: slice.projectId,
        userId: period.userId,
      }))
    ) {
      throw new ForbiddenException(
        'You are not the approver for this project slice',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const entryIds = await this.applySliceDecisionToLines(
        tx,
        organisationId,
        period,
        slice.projectId,
        'approved',
      );
      for (const entryId of entryIds) {
        await this.syncEntryStatusFromLines(tx, organisationId, entryId);
      }
      await this.syncSliceStatusFromLines(tx, organisationId, slice, period);

      await tx.approval.create({
        data: {
          organisationId,
          timesheetPeriodId: period.id,
          timesheetPeriodSliceId: slice.id,
          approverId: membership.id,
          decision: 'approved',
          decidedAt: new Date(),
        },
      });

      return this.syncPeriodStatusFromSlices(tx, organisationId, period);
    });

    await this.audit.writeAudit({
      organisationId,
      actorMembershipId: membership.id,
      entityType: ENTITY_TYPE,
      entityId: period.id,
      action: 'approve',
      oldValue: { status: period.status, sliceId: slice.id },
      newValue: { status: updated.status, sliceId: slice.id },
    });

    const full = await this.prisma.timesheetPeriod.findFirstOrThrow({
      where: { id: updated.id },
      include: this.periodInclude(),
    });
    return this.toResponse(full);
  }

  async reject(
    organisationId: string,
    membership: AuthMembership,
    sliceId: string,
    dto: RejectTimesheetDto,
  ) {
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Rejection reason is required');
    }

    const slice = await this.findSliceOrThrow(organisationId, sliceId);
    const period = slice.timesheetPeriod;
    await this.assertSliceAwaitingDecision(organisationId, slice, period);
    if (period.status !== 'submitted') {
      throw new BadRequestException(
        `Period is not awaiting approval (current: ${period.status})`,
      );
    }
    if (
      !(await this.canApproveSlice(organisationId, membership, {
        projectId: slice.projectId,
        userId: period.userId,
      }))
    ) {
      throw new ForbiddenException(
        'You are not the approver for this project slice',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const entryIds = await this.applySliceDecisionToLines(
        tx,
        organisationId,
        period,
        slice.projectId,
        'rejected',
      );
      for (const entryId of entryIds) {
        await this.syncEntryStatusFromLines(tx, organisationId, entryId);
      }
      await this.syncSliceStatusFromLines(tx, organisationId, slice, period);

      await tx.approval.create({
        data: {
          organisationId,
          timesheetPeriodId: period.id,
          timesheetPeriodSliceId: slice.id,
          approverId: membership.id,
          decision: 'rejected',
          reason,
          decidedAt: new Date(),
        },
      });

      return this.syncPeriodStatusFromSlices(tx, organisationId, period);
    });

    await this.audit.writeAudit({
      organisationId,
      actorMembershipId: membership.id,
      entityType: ENTITY_TYPE,
      entityId: period.id,
      action: 'reject',
      oldValue: { status: period.status, sliceId: slice.id },
      newValue: { status: updated.status, reason, sliceId: slice.id },
    });

    const full = await this.prisma.timesheetPeriod.findFirstOrThrow({
      where: { id: updated.id },
      include: this.periodInclude(),
    });
    return this.toResponse(full);
  }

  async approveLine(
    organisationId: string,
    membership: AuthMembership,
    sliceId: string,
    lineId: string,
  ) {
    const slice = await this.findSliceOrThrow(organisationId, sliceId);
    const period = slice.timesheetPeriod;
    if (period.status !== 'submitted') {
      throw new BadRequestException(
        `Period is not awaiting approval (current: ${period.status})`,
      );
    }
    if (!period.periodStart || !period.periodEnd) {
      throw new BadRequestException('Period has no date range');
    }
    if (
      !(await this.canApproveSlice(organisationId, membership, {
        projectId: slice.projectId,
        userId: period.userId,
      }))
    ) {
      throw new ForbiddenException(
        'You are not the approver for this project slice',
      );
    }

    const line = await this.prisma.timeLine.findFirst({
      where: {
        id: lineId,
        organisationId,
        status: 'submitted',
        projectId: slice.projectId,
        timeEntry: {
          userId: period.userId,
          entryDate: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
        },
      },
    });
    if (!line) {
      throw new NotFoundException(
        'Submitted time line not found in this slice',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.timeLine.update({
        where: { id: line.id },
        data: { status: 'approved' },
      });
      await this.syncEntryStatusFromLines(tx, organisationId, line.timeEntryId);
      await this.syncSliceStatusFromLines(tx, organisationId, slice, period);

      await tx.approval.create({
        data: {
          organisationId,
          timesheetPeriodId: period.id,
          timesheetPeriodSliceId: slice.id,
          approverId: membership.id,
          decision: 'approved',
          decidedAt: new Date(),
        },
      });

      return this.syncPeriodStatusFromSlices(tx, organisationId, period);
    });

    await this.audit.writeAudit({
      organisationId,
      actorMembershipId: membership.id,
      entityType: ENTITY_TYPE,
      entityId: period.id,
      action: 'approve',
      oldValue: { status: period.status, sliceId: slice.id, lineId },
      newValue: { status: updated.status, sliceId: slice.id, lineId },
    });

    const full = await this.prisma.timesheetPeriod.findFirstOrThrow({
      where: { id: updated.id },
      include: this.periodInclude(),
    });
    return this.toResponse(full);
  }

  async rejectLine(
    organisationId: string,
    membership: AuthMembership,
    sliceId: string,
    lineId: string,
    dto: RejectTimesheetDto,
  ) {
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Rejection reason is required');
    }

    const slice = await this.findSliceOrThrow(organisationId, sliceId);
    const period = slice.timesheetPeriod;
    if (period.status !== 'submitted') {
      throw new BadRequestException(
        `Period is not awaiting approval (current: ${period.status})`,
      );
    }
    if (!period.periodStart || !period.periodEnd) {
      throw new BadRequestException('Period has no date range');
    }
    if (
      !(await this.canApproveSlice(organisationId, membership, {
        projectId: slice.projectId,
        userId: period.userId,
      }))
    ) {
      throw new ForbiddenException(
        'You are not the approver for this project slice',
      );
    }

    const line = await this.prisma.timeLine.findFirst({
      where: {
        id: lineId,
        organisationId,
        status: 'submitted',
        projectId: slice.projectId,
        timeEntry: {
          userId: period.userId,
          entryDate: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
        },
      },
    });
    if (!line) {
      throw new NotFoundException(
        'Submitted time line not found in this slice',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.timeLine.update({
        where: { id: line.id },
        data: { status: 'rejected' },
      });
      await this.syncEntryStatusFromLines(tx, organisationId, line.timeEntryId);
      await this.syncSliceStatusFromLines(tx, organisationId, slice, period);

      await tx.approval.create({
        data: {
          organisationId,
          timesheetPeriodId: period.id,
          timesheetPeriodSliceId: slice.id,
          approverId: membership.id,
          decision: 'rejected',
          reason,
          decidedAt: new Date(),
        },
      });

      return this.syncPeriodStatusFromSlices(tx, organisationId, period);
    });

    await this.audit.writeAudit({
      organisationId,
      actorMembershipId: membership.id,
      entityType: ENTITY_TYPE,
      entityId: period.id,
      action: 'reject',
      oldValue: { status: period.status, sliceId: slice.id, lineId },
      newValue: { status: updated.status, reason, sliceId: slice.id, lineId },
    });

    const full = await this.prisma.timesheetPeriod.findFirstOrThrow({
      where: { id: updated.id },
      include: this.periodInclude(),
    });
    return this.toResponse(full);
  }

  /**
   * FIX 7 — throw if this user/date is inside a submitted/approved/locked period.
   * Call before creating or mutating time for that day.
   */
  async assertDateUnlocked(
    organisationId: string,
    userId: string,
    entryDate: Date | string,
  ): Promise<void> {
    const day = this.dateOnly(
      typeof entryDate === 'string'
        ? entryDate.slice(0, 10)
        : entryDate.toISOString().slice(0, 10),
    );

    const locked = await this.prisma.timesheetPeriod.findFirst({
      where: {
        organisationId,
        userId,
        status: { in: [...LOCKED_PERIOD_STATUSES] },
        periodStart: { lte: day },
        periodEnd: { gte: day },
      },
      select: { id: true, status: true },
    });

    if (locked) {
      throw new ForbiddenException(
        locked.status === 'submitted'
          ? 'This date is locked (submitted). You cannot add or change time until a manager approves or rejects it. After a rejection, edit the rejected entry and resubmit.'
          : `This date is locked (${locked.status}). Waiting for approval or already approved.`,
      );
    }
  }

  async assertEntryUnlocked(
    organisationId: string,
    entry: { userId: string; entryDate: Date; status: string },
  ): Promise<void> {
    if (
      entry.status === 'submitted' ||
      entry.status === 'approved' ||
      entry.status === 'locked'
    ) {
      throw new ForbiddenException(
        `This time entry is ${entry.status} and cannot be edited`,
      );
    }

    // Rejected (or draft) lines must be editable after a manager rejects them,
    // even while the overall period is still `submitted` (other lines pending).
    // Only fully closed periods (approved / locked) keep the day sealed.
    if (entry.status === 'rejected' || entry.status === 'draft') {
      const day = this.dateOnly(entry.entryDate.toISOString().slice(0, 10));
      const sealed = await this.prisma.timesheetPeriod.findFirst({
        where: {
          organisationId,
          userId: entry.userId,
          status: { in: ['approved', 'locked'] },
          periodStart: { lte: day },
          periodEnd: { gte: day },
        },
        select: { id: true, status: true },
      });
      if (sealed) {
        throw new ForbiddenException(
          `This date is locked (${sealed.status}). Waiting for approval or already approved.`,
        );
      }
      return;
    }

    await this.assertDateUnlocked(
      organisationId,
      entry.userId,
      entry.entryDate,
    );
  }

  private async canApproveSlice(
    organisationId: string,
    membership: AuthMembership,
    ctx: { projectId: string | null; userId: string },
  ): Promise<boolean> {
    const scope = scopeFor(membership.permissions, 'timesheet', 'approve');
    if (!scope) return false;
    if (scope === 'all') return true;

    if (ctx.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: ctx.projectId, organisationId },
        select: { ownerId: true },
      });
      return project?.ownerId === membership.id;
    }

    const subject = await this.prisma.membership.findFirst({
      where: {
        organisationId,
        userId: ctx.userId,
        status: 'active',
      },
      select: { managerId: true },
    });
    return subject?.managerId === membership.id;
  }

  private async canApprovePeriod(
    organisationId: string,
    membership: AuthMembership,
    period: { userId: string; periodStart: Date | null; periodEnd: Date | null },
  ): Promise<boolean> {
    const scope = scopeFor(membership.permissions, 'timesheet', 'approve');
    if (!scope) return false;
    // Admin / owner — see all approvals
    if (scope === 'all') return true;

    // Line manager only (assigned managerId) — not every PM
    const subject = await this.prisma.membership.findFirst({
      where: {
        organisationId,
        userId: period.userId,
        status: 'active',
      },
      select: { id: true, managerId: true },
    });
    return subject?.managerId === membership.id;
  }

  private periodKind(
    periodStart: Date | null,
    periodEnd: Date | null,
  ): 'day' | 'week' | 'custom' {
    if (!periodStart || !periodEnd) return 'custom';
    const startKey = periodStart.toISOString().slice(0, 10);
    const endKey = periodEnd.toISOString().slice(0, 10);
    if (startKey === endKey) return 'day';
    const ms = periodEnd.getTime() - periodStart.getTime();
    const days = Math.round(ms / 86_400_000) + 1;
    if (days === 7) return 'week';
    return 'custom';
  }

  private async managerContextForUser(
    organisationId: string,
    userId: string,
  ): Promise<{
    managerMembershipId: string | null;
    managerName: string | null;
  }> {
    const subject = await this.prisma.membership.findFirst({
      where: { organisationId, userId, status: 'active' },
      select: {
        managerId: true,
        manager: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!subject?.managerId || !subject.manager) {
      return { managerMembershipId: null, managerName: null };
    }
    return {
      managerMembershipId: subject.manager.id,
      managerName:
        subject.manager.user.name || subject.manager.user.email || null,
    };
  }

  /**
   * Days in [start,end] already covered by another submitted/approved/locked period.
   */
  private async lockedDaysInRange(
    organisationId: string,
    userId: string,
    start: Date,
    end: Date,
    excludePeriodId?: string,
  ): Promise<string[]> {
    const locked = await this.prisma.timesheetPeriod.findMany({
      where: {
        organisationId,
        userId,
        status: { in: [...LOCKED_PERIOD_STATUSES] },
        periodStart: { lte: end },
        periodEnd: { gte: start },
        ...(excludePeriodId ? { id: { not: excludePeriodId } } : {}),
      },
      select: { periodStart: true, periodEnd: true },
    });

    const days: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      const hit = locked.some((p) => {
        if (!p.periodStart || !p.periodEnd) return false;
        return p.periodStart <= cursor && p.periodEnd >= cursor;
      });
      if (hit) days.push(key);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }

  private async findSliceOrThrow(
    organisationId: string,
    sliceId: string,
  ) {
    const slice = await this.prisma.timesheetPeriodSlice.findFirst({
      where: { id: sliceId, organisationId },
      include: { timesheetPeriod: true },
    });
    if (!slice) {
      throw new NotFoundException('Timesheet slice not found');
    }
    return slice;
  }

  private async rebuildSlicesForPeriod(
    organisationId: string,
    periodId: string,
    userId: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.timesheetPeriodSlice.deleteMany({
        where: { timesheetPeriodId: periodId, organisationId },
      });

      const lines = await tx.timeLine.findMany({
        where: {
          organisationId,
          timeEntry: {
            userId,
            entryDate: { gte: start, lte: end },
          },
        },
        select: { projectId: true },
      });

      const projectIds = new Set<string | null>();
      for (const line of lines) {
        projectIds.add(line.projectId ?? null);
      }

      for (const projectId of projectIds) {
        await tx.timesheetPeriodSlice.create({
          data: {
            organisationId,
            timesheetPeriodId: periodId,
            projectId,
            status: 'submitted',
          },
        });
      }
    });
  }

  private async assertSliceAwaitingDecision(
    organisationId: string,
    slice: { id: string; status: string; projectId: string | null },
    period: TimesheetPeriod,
  ): Promise<void> {
    if (slice.status === 'submitted') return;
    if (!period.periodStart || !period.periodEnd) {
      throw new BadRequestException('Period has no date range');
    }
    const submittedLineCount = await this.prisma.timeLine.count({
      where: {
        organisationId,
        status: 'submitted',
        projectId: slice.projectId,
        timeEntry: {
          userId: period.userId,
          entryDate: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
        },
      },
    });
    if (submittedLineCount === 0) {
      throw new BadRequestException(
        `Slice is not awaiting approval (current: ${slice.status})`,
      );
    }
  }

  private async applySliceDecisionToLines(
    tx: Prisma.TransactionClient,
    organisationId: string,
    period: TimesheetPeriod,
    projectId: string | null,
    nextStatus: 'approved' | 'rejected',
  ): Promise<string[]> {
    if (!period.periodStart || !period.periodEnd) return [];

    const lines = await tx.timeLine.findMany({
      where: {
        organisationId,
        status: 'submitted',
        projectId,
        timeEntry: {
          userId: period.userId,
          entryDate: { gte: period.periodStart, lte: period.periodEnd },
        },
      },
      select: { id: true, timeEntryId: true },
    });

    if (lines.length === 0) return [];

    await tx.timeLine.updateMany({
      where: { id: { in: lines.map((l) => l.id) }, organisationId },
      data: { status: nextStatus },
    });

    return [...new Set(lines.map((l) => l.timeEntryId))];
  }

  private async syncEntryStatusFromLines(
    tx: Prisma.TransactionClient,
    organisationId: string,
    entryId: string,
  ): Promise<void> {
    const entry = await tx.timeEntry.findFirst({
      where: { id: entryId, organisationId },
      select: { id: true, status: true },
    });
    if (!entry || entry.status === 'locked') return;

    const lines = await tx.timeLine.findMany({
      where: { timeEntryId: entryId, organisationId },
      select: { status: true },
    });
    if (lines.length === 0) return;

    const allApproved = lines.every((l) => l.status === 'approved');
    const anySubmitted = lines.some((l) => l.status === 'submitted');
    const anyRejected = lines.some((l) => l.status === 'rejected');

    let nextStatus: string | null = null;
    if (allApproved) nextStatus = 'approved';
    else if (!anySubmitted && anyRejected) nextStatus = 'rejected';
    else if (anySubmitted) nextStatus = 'submitted';

    if (nextStatus && nextStatus !== entry.status) {
      await tx.timeEntry.update({
        where: { id: entryId },
        data: { status: nextStatus },
      });
    }
  }

  private async syncSliceStatusFromLines(
    tx: Prisma.TransactionClient,
    organisationId: string,
    slice: { id: string; projectId: string | null; status: string },
    period: TimesheetPeriod,
  ): Promise<void> {
    if (!period.periodStart || !period.periodEnd) return;

    const lines = await tx.timeLine.findMany({
      where: {
        organisationId,
        projectId: slice.projectId,
        timeEntry: {
          userId: period.userId,
          entryDate: { gte: period.periodStart, lte: period.periodEnd },
        },
      },
      select: { status: true },
    });

    const allApproved =
      lines.length > 0 && lines.every((l) => l.status === 'approved');
    const anySubmitted = lines.some((l) => l.status === 'submitted');
    const anyRejected = lines.some((l) => l.status === 'rejected');

    let nextStatus: string;
    if (allApproved) nextStatus = 'approved';
    else if (!anySubmitted && anyRejected) nextStatus = 'rejected';
    else nextStatus = 'submitted';

    const data: { status: string; decidedAt?: Date } = { status: nextStatus };
    if (slice.status === 'submitted' && nextStatus !== 'submitted') {
      data.decidedAt = new Date();
    }

    await tx.timesheetPeriodSlice.update({
      where: { id: slice.id },
      data,
    });
  }

  private async syncPeriodStatusFromSlices(
    tx: Prisma.TransactionClient,
    organisationId: string,
    period: TimesheetPeriod,
  ): Promise<TimesheetPeriod> {
    const slices = await tx.timesheetPeriodSlice.findMany({
      where: { timesheetPeriodId: period.id, organisationId },
    });

    if (slices.length === 0) {
      return period;
    }

    const allApproved = slices.every((s) => s.status === 'approved');
    const anySubmitted = slices.some((s) => s.status === 'submitted');
    const anyRejected = slices.some((s) => s.status === 'rejected');

    if (allApproved) {
      await tx.timesheetPeriod.update({
        where: { id: period.id },
        data: { status: 'approved' },
      });
    } else if (anyRejected && !anySubmitted) {
      await tx.timesheetPeriod.update({
        where: { id: period.id },
        data: { status: 'rejected' },
      });
    } else {
      await tx.timesheetPeriod.update({
        where: { id: period.id },
        data: { status: 'submitted' },
      });
    }

    return tx.timesheetPeriod.findFirstOrThrow({
      where: { id: period.id },
    });
  }

  private async entryStats(
    organisationId: string,
    userId: string,
    start: Date,
    end: Date,
  ) {
    const [entryCount, runningCount, durationAgg] = await Promise.all([
      this.prisma.timeEntry.count({
        where: {
          organisationId,
          userId,
          entryDate: { gte: start, lte: end },
        },
      }),
      this.prisma.timeEntry.count({
        where: {
          organisationId,
          userId,
          entryDate: { gte: start, lte: end },
          endTime: null,
        },
      }),
      this.prisma.timeLine.aggregate({
        where: {
          organisationId,
          timeEntry: {
            organisationId,
            userId,
            entryDate: { gte: start, lte: end },
          },
        },
        _sum: { durationMinutes: true },
      }),
    ]);

    return {
      entryCount,
      runningCount,
      durationMinutes: durationAgg._sum.durationMinutes ?? 0,
    };
  }

  private periodInclude() {
    return {
      user: { select: { id: true, email: true, name: true } },
      approvals: {
        orderBy: { createdAt: 'desc' as const },
        take: 5,
        select: {
          id: true,
          decision: true,
          reason: true,
          decidedAt: true,
          approverId: true,
          createdAt: true,
        },
      },
    } satisfies Prisma.TimesheetPeriodInclude;
  }

  private toResponse(period: PeriodWithApprovals) {
    return {
      id: period.id,
      organisationId: period.organisationId,
      userId: period.userId,
      periodStart: period.periodStart
        ? period.periodStart.toISOString().slice(0, 10)
        : null,
      periodEnd: period.periodEnd
        ? period.periodEnd.toISOString().slice(0, 10)
        : null,
      status: period.status,
      submittedAt: period.submittedAt,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
      user: period.user,
      approvals: period.approvals,
    };
  }

  /**
   * FINAL FIX 6 — totals + project→task breakdown (with day lines) for approvers.
   */
  private async buildPeriodReview(
    organisationId: string,
    userId: string,
    periodStart: Date | null,
    periodEnd: Date | null,
    filterProjectId?: string | null,
  ) {
    if (!periodStart || !periodEnd) {
      return {
        durationMinutes: 0,
        billableMinutes: 0,
        nonBillableMinutes: 0,
        entryCount: 0,
        projects: [] as Array<{
          projectId: string | null;
          projectName: string;
          durationMinutes: number;
          billableMinutes: number;
          tasks: Array<{
            taskId: string | null;
            taskName: string;
            durationMinutes: number;
            billableMinutes: number;
            descriptions: string[];
            days: Array<{
              lineId: string;
              entryId: string;
              entryDate: string;
              durationMinutes: number;
              description: string | null;
              billable: boolean;
              status: string;
            }>;
          }>;
        }>,
      };
    }

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        organisationId,
        userId,
        entryDate: { gte: periodStart, lte: periodEnd },
      },
      include: {
        timeLines: {
          orderBy: { createdAt: 'asc' },
          include: {
            task: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
    });

    type DayRow = {
      lineId: string;
      entryId: string;
      entryDate: string;
      durationMinutes: number;
      description: string | null;
      billable: boolean;
      status: string;
    };
    type TaskBucket = {
      taskId: string | null;
      taskName: string;
      durationMinutes: number;
      billableMinutes: number;
      descriptions: Set<string>;
      days: DayRow[];
    };
    type ProjectBucket = {
      projectId: string | null;
      projectName: string;
      durationMinutes: number;
      billableMinutes: number;
      tasks: Map<string, TaskBucket>;
    };

    const projects = new Map<string, ProjectBucket>();
    let durationMinutes = 0;
    let billableMinutes = 0;
    let entryCount = 0;
    const entriesWithLines = new Set<string>();

    for (const entry of entries) {
      const entryDate = entry.entryDate.toISOString().slice(0, 10);
      for (const line of entry.timeLines) {
        const projectId = line.projectId ?? line.project?.id ?? null;
        if (
          filterProjectId !== undefined &&
          projectId !== filterProjectId
        ) {
          continue;
        }

        entriesWithLines.add(entry.id);
        const mins = line.durationMinutes ?? 0;
        durationMinutes += mins;
        if (line.billable) billableMinutes += mins;

        const projectKey = projectId ?? '__none__';
        const projectName =
          line.project?.name ?? (projectId ? 'Project' : 'No project');

        let project = projects.get(projectKey);
        if (!project) {
          project = {
            projectId,
            projectName,
            durationMinutes: 0,
            billableMinutes: 0,
            tasks: new Map(),
          };
          projects.set(projectKey, project);
        }
        project.durationMinutes += mins;
        if (line.billable) project.billableMinutes += mins;

        const taskId = line.taskId ?? line.task?.id ?? null;
        const taskKey = taskId ?? '__none__';
        const taskName = line.task?.name ?? (taskId ? 'Task' : 'No task');

        let task = project.tasks.get(taskKey);
        if (!task) {
          task = {
            taskId,
            taskName,
            durationMinutes: 0,
            billableMinutes: 0,
            descriptions: new Set(),
            days: [],
          };
          project.tasks.set(taskKey, task);
        }
        task.durationMinutes += mins;
        if (line.billable) task.billableMinutes += mins;
        const note = line.description?.trim();
        if (note) task.descriptions.add(note);
        task.days.push({
          lineId: line.id,
          entryId: entry.id,
          entryDate,
          durationMinutes: mins,
          description: note || null,
          billable: line.billable,
          status: line.status,
        });
      }
    }

    const projectList = [...projects.values()]
      .sort((a, b) => b.durationMinutes - a.durationMinutes)
      .map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        durationMinutes: p.durationMinutes,
        billableMinutes: p.billableMinutes,
        tasks: [...p.tasks.values()]
          .sort((a, b) => b.durationMinutes - a.durationMinutes)
          .map((t) => ({
            taskId: t.taskId,
            taskName: t.taskName,
            durationMinutes: t.durationMinutes,
            billableMinutes: t.billableMinutes,
            descriptions: [...t.descriptions],
            days: t.days,
          })),
      }));

    return {
      durationMinutes,
      billableMinutes,
      nonBillableMinutes: durationMinutes - billableMinutes,
      entryCount:
        filterProjectId !== undefined
          ? entriesWithLines.size
          : entries.length,
      projects: projectList,
    };
  }

  private dateOnly(isoDate: string): Date {
    return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  }

  private assertRange(periodStart: string, periodEnd: string): void {
    if (new Date(periodEnd) < new Date(periodStart)) {
      throw new BadRequestException('periodEnd cannot be before periodStart');
    }
  }
}
