import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, TimeEntry, TimeLine } from '@prisma/client';
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
import { TimesheetsService } from '../timesheets/timesheets.service';
import { CreateTimeEntryDto, TimeLineInputDto } from './dto/create-time-entry.dto';
import { CreateTimeLineDto } from './dto/create-time-line.dto';
import { ListTimeEntriesQueryDto } from './dto/list-time-entries-query.dto';
import { StopTimeEntryDto } from './dto/stop-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { UpdateTimeLineDto } from './dto/update-time-line.dto';

const ENTRY_ENTITY = 'time_entry';
const LINE_ENTITY = 'time_line';

type EntryWithLines = TimeEntry & { timeLines: TimeLine[] };

type ResolvedLineFields = {
  taskId: string | null;
  projectId: string | null;
  clientId: string | null;
  ticketId: string | null;
  ticketType: string | null;
  area: string | null;
  crId: string | null;
  crNumber: string | null;
  durationMinutes: number;
  billable: boolean;
  description: string | null;
};

@Injectable()
export class TimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
    private readonly timesheets: TimesheetsService,
  ) {}

  async createEntry(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    dto: CreateTimeEntryDto,
  ): Promise<EntryWithLines> {
    const source = dto.source ?? (dto.endTime == null ? 'timer' : 'manual');
    let startTime = dto.startTime
      ? new Date(dto.startTime)
      : source === 'timer'
        ? new Date()
        : null;
    let endTime =
      dto.endTime === undefined
        ? source === 'timer'
          ? null
          : null
        : dto.endTime === null
          ? null
          : new Date(dto.endTime);

    if (source === 'timer' && endTime !== null) {
      throw new BadRequestException(
        'Timer entries must have endTime null until stopped',
      );
    }

    // FIX 4 — only one running timer per user
    if (source === 'timer') {
      const alreadyRunning = await this.prisma.timeEntry.findFirst({
        where: {
          organisationId,
          userId,
          endTime: null,
          source: 'timer',
        },
        select: { id: true },
      });
      if (alreadyRunning) {
        throw new BadRequestException(
          'Stop your running timer before starting another',
        );
      }
    }

    // Manual/API entries must be closed — derive from duration if needed
    if (source !== 'timer' && endTime === null) {
      const mins = dto.line?.durationMinutes ?? 0;
      if (mins < 1) {
        throw new BadRequestException(
          'Manual time entries require endTime or a positive duration',
        );
      }
      const start =
        startTime ?? new Date(`${dto.entryDate.slice(0, 10)}T09:00:00`);
      startTime = start;
      endTime = new Date(start.getTime() + mins * 60_000);
    }

    this.assertNotFutureDate(dto.entryDate);

    await this.timesheets.assertDateUnlocked(
      organisationId,
      userId,
      dto.entryDate,
    );

    const lineData = await this.resolveLineInput(organisationId, dto.line);
    await this.visibility.assertCanLogTime(organisationId, membership, {
      taskId: lineData.taskId,
      projectId: lineData.projectId,
    });
    await this.assertWithinProjectBudget(
      organisationId,
      lineData.projectId,
      lineData.durationMinutes,
    );

    // FIX 2 — no overlapping closed ranges for the same user/day
    if (startTime && endTime) {
      await this.assertNoTimeOverlap(
        organisationId,
        userId,
        dto.entryDate.slice(0, 10),
        startTime,
        endTime,
      );
    }

    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const created = await tx.timeEntry.create({
          data: {
            organisationId,
            userId,
            entryDate: new Date(dto.entryDate),
            startTime,
            endTime,
            status: 'draft',
            source,
            timeLines: {
              create: {
                organisationId,
                ...lineData,
                isFirstLine: true,
              },
            },
          },
          include: { timeLines: { orderBy: { createdAt: 'asc' } } },
        });
        return created;
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTRY_ENTITY,
        entityId: entry.id,
        action: 'create',
        oldValue: null,
        newValue: this.entryAudit(entry),
      });

      return entry;
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

  async stopEntry(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    id: string,
    dto: StopTimeEntryDto,
  ): Promise<EntryWithLines> {
    const existing = await this.findMutableEntryOrThrow(
      organisationId,
      membership,
      userId,
      id,
    );
    await this.timesheets.assertEntryUnlocked(organisationId, existing);

    if (existing.endTime !== null) {
      throw new BadRequestException('This time entry is already stopped');
    }

    const endTime = dto.endTime ? new Date(dto.endTime) : new Date();
    if (existing.startTime && endTime < existing.startTime) {
      throw new BadRequestException('endTime cannot be before startTime');
    }

    const firstLine = existing.timeLines.find((l) => l.isFirstLine);
    const minutes =
      existing.startTime != null
        ? Math.max(
            1,
            Math.round(
              (endTime.getTime() - existing.startTime.getTime()) / 60000,
            ),
          )
        : firstLine?.durationMinutes ?? 1;

    if (firstLine?.projectId) {
      await this.assertWithinProjectBudget(
        organisationId,
        firstLine.projectId,
        minutes,
        firstLine.id,
      );
    }

    // FIX 2 — timer stop cannot overlap another closed entry
    if (existing.startTime) {
      await this.assertNoTimeOverlap(
        organisationId,
        userId,
        existing.entryDate.toISOString().slice(0, 10),
        existing.startTime,
        endTime,
        existing.id,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.timeEntry.updateMany({
          where: { id: existing.id, organisationId, userId: existing.userId },
          data: { endTime },
        });
        if (firstLine) {
          await tx.timeLine.updateMany({
            where: { id: firstLine.id, organisationId },
            data: { durationMinutes: minutes },
          });
        }
      });

      const updated = await this.findMutableEntryOrThrow(
        organisationId,
        membership,
        userId,
        id,
      );

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTRY_ENTITY,
        entityId: updated.id,
        action: 'stop',
        oldValue: this.entryAudit(existing),
        newValue: this.entryAudit(updated),
      });

      return updated;
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

  /**
   * FIX 8 — update start/end/entryDate after calendar drag or resize.
   * When both start and end are set, sync the first line's durationMinutes.
   */
  async updateEntry(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    id: string,
    dto: UpdateTimeEntryDto,
  ): Promise<EntryWithLines> {
    const existing = await this.findMutableEntryOrThrow(
      organisationId,
      membership,
      userId,
      id,
    );
    await this.timesheets.assertEntryUnlocked(organisationId, existing);

    const nextEntryDate = dto.entryDate
      ? new Date(dto.entryDate)
      : existing.entryDate;
    const nextStart =
      dto.startTime !== undefined
        ? new Date(dto.startTime)
        : existing.startTime;
    const nextEnd =
      dto.endTime === undefined
        ? existing.endTime
        : dto.endTime === null
          ? null
          : new Date(dto.endTime);

    if (nextStart && nextEnd && nextEnd < nextStart) {
      throw new BadRequestException('endTime cannot be before startTime');
    }

    if (
      existing.source !== 'timer' &&
      dto.endTime !== undefined &&
      nextEnd === null
    ) {
      throw new BadRequestException(
        'Manual time entries cannot have a null endTime',
      );
    }

    // Moving to another day — that day must also be unlocked and not in the future
    if (dto.entryDate) {
      this.assertNotFutureDate(dto.entryDate);
      await this.timesheets.assertDateUnlocked(
        organisationId,
        existing.userId,
        dto.entryDate,
      );
    }

    if (nextStart && nextEnd) {
      const minutes = Math.max(
        1,
        Math.round((nextEnd.getTime() - nextStart.getTime()) / 60000),
      );
      const firstLine = existing.timeLines.find((l) => l.isFirstLine);
      if (firstLine?.projectId) {
        await this.assertWithinProjectBudget(
          organisationId,
          firstLine.projectId,
          minutes,
          firstLine.id,
        );
      }
      await this.assertNoTimeOverlap(
        organisationId,
        userId,
        (dto.entryDate ?? existing.entryDate.toISOString().slice(0, 10)).slice(
          0,
          10,
        ),
        nextStart,
        nextEnd,
        existing.id,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.timeEntry.updateMany({
          where: { id: existing.id, organisationId, userId: existing.userId },
          data: {
            ...(dto.entryDate !== undefined
              ? { entryDate: nextEntryDate }
              : {}),
            ...(dto.startTime !== undefined ? { startTime: nextStart } : {}),
            ...(dto.endTime !== undefined ? { endTime: nextEnd } : {}),
          },
        });

        if (nextStart && nextEnd) {
          const minutes = Math.max(
            1,
            Math.round((nextEnd.getTime() - nextStart.getTime()) / 60000),
          );
          const firstLine = existing.timeLines.find((l) => l.isFirstLine);
          if (firstLine) {
            await tx.timeLine.updateMany({
              where: { id: firstLine.id, organisationId },
              data: { durationMinutes: minutes },
            });
          }
        }
      });

      const updated = await this.findMutableEntryOrThrow(
        organisationId,
        membership,
        userId,
        id,
      );

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTRY_ENTITY,
        entityId: updated.id,
        action: 'update',
        oldValue: this.entryAudit(existing),
        newValue: this.entryAudit(updated),
      });

      return updated;
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

  /**
   * FINAL FIX 2 — delete a whole entry (Level 1: one entry = one activity block).
   * Cascades lines; refused when the week/entry is locked.
   */
  async deleteEntry(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.findMutableEntryOrThrow(
      organisationId,
      membership,
      userId,
      id,
    );
    await this.timesheets.assertEntryUnlocked(organisationId, existing);

    if (existing.endTime === null && existing.source === 'timer') {
      throw new BadRequestException('Stop the running timer before deleting it');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.timeLine.deleteMany({
          where: { timeEntryId: existing.id, organisationId },
        });
        await tx.timeEntry.deleteMany({
          where: { id: existing.id, organisationId },
        });
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTRY_ENTITY,
        entityId: existing.id,
        action: 'delete',
        oldValue: this.entryAudit(existing),
        newValue: null,
      });

      return { deleted: true, id: existing.id };
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

  async listEntries(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    query: ListTimeEntriesQueryDto,
  ): Promise<PaginatedResult<EntryWithLines>> {
    const { page, pageSize, skip, take } = resolvePagination(query);

    const visibilityWhere = await this.visibility.timeEntryWhere(
      organisationId,
      membership,
      userId,
    );

    const dateFilter =
      query.dateFrom || query.dateTo
        ? {
            entryDate: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {};

    let where: Prisma.TimeEntryWhereInput;

    if (query.taskId) {
      // Task Track timeline: visibility scope (admin/all or managed can see
      // others' lines on that task). Caller must be able to view the task.
      const taskVis = await this.visibility.taskWhere(
        organisationId,
        membership,
      );
      const task = await this.prisma.task.findFirst({
        where: { id: query.taskId, organisationId, ...taskVis },
        select: { id: true },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }

      where = {
        organisationId,
        ...visibilityWhere,
        ...dateFilter,
        timeLines: { some: { taskId: query.taskId } },
      };
    } else {
      // Personal Timesheet/Calendar: always the caller's own entries, even when
      // time_entry:edit scope is `all` (admin/owner). Team review is Approvals/Reports.
      // `userId` must come after visibilityWhere so it overrides scope `all` → {}.
      where = {
        organisationId,
        ...visibilityWhere,
        userId,
        ...dateFilter,
      };
    }

    try {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.timeEntry.findMany({
          where,
          include: { timeLines: { orderBy: { createdAt: 'asc' } } },
          orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
          skip,
          take,
        }),
        this.prisma.timeEntry.count({ where }),
      ]);

      return buildPaginatedResult(data, total, page, pageSize);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async getEntry(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    id: string,
  ): Promise<EntryWithLines> {
    const visibilityWhere = await this.visibility.timeEntryWhere(
      organisationId,
      membership,
      userId,
    );
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, organisationId, ...visibilityWhere, userId },
      include: { timeLines: { orderBy: { createdAt: 'asc' } } },
    });
    if (!entry) {
      throw new NotFoundException('Time entry not found');
    }
    return entry;
  }

  async addLine(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    entryId: string,
    dto: CreateTimeLineDto,
  ): Promise<TimeLine> {
    const entry = await this.findMutableEntryOrThrow(
      organisationId,
      membership,
      userId,
      entryId,
    );
    await this.timesheets.assertEntryUnlocked(organisationId, entry);
    const lineData = await this.resolveLineInput(organisationId, dto);
    await this.visibility.assertCanLogTime(organisationId, membership, {
      taskId: lineData.taskId,
      projectId: lineData.projectId,
    });
    await this.assertWithinProjectBudget(
      organisationId,
      lineData.projectId,
      lineData.durationMinutes,
    );

    try {
      const line = await this.prisma.timeLine.create({
        data: {
          organisationId,
          timeEntryId: entryId,
          ...lineData,
          isFirstLine: false,
        },
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: LINE_ENTITY,
        entityId: line.id,
        action: 'create',
        oldValue: null,
        newValue: this.lineAudit(line),
      });

      return line;
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

  async updateLine(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    lineId: string,
    dto: UpdateTimeLineDto,
  ): Promise<TimeLine> {
    const existing = await this.findMutableLineOrThrow(
      organisationId,
      membership,
      userId,
      lineId,
    );
    const parentEntry = await this.prisma.timeEntry.findFirst({
      where: { id: existing.timeEntryId, organisationId },
    });
    if (!parentEntry) {
      throw new NotFoundException('Time entry not found');
    }
    await this.timesheets.assertEntryUnlocked(organisationId, parentEntry);

    const mergedTicketType =
      dto.ticketType !== undefined ? dto.ticketType : existing.ticketType;
    const mergedCrId = dto.crId !== undefined ? dto.crId : existing.crId;
    const mergedCrNumber =
      dto.crNumber !== undefined ? dto.crNumber : existing.crNumber;

    if (mergedTicketType === 'cr') {
      if (!mergedCrId || !mergedCrNumber) {
        throw new BadRequestException(
          'crId and crNumber are required when ticketType is cr',
        );
      }
    }

    let taskId =
      dto.taskId !== undefined ? dto.taskId : existing.taskId;
    let projectId =
      dto.projectId !== undefined ? dto.projectId : existing.projectId;
    let clientId =
      dto.clientId !== undefined ? dto.clientId : existing.clientId;

    if (dto.taskId) {
      const resolved = await this.resolveFromTask(organisationId, dto.taskId);
      taskId = resolved.taskId;
      projectId = resolved.projectId;
      clientId = resolved.clientId;
    } else {
      if (dto.projectId) {
        await this.assertProjectInOrg(organisationId, dto.projectId);
      }
      if (dto.clientId) {
        await this.assertClientInOrg(organisationId, dto.clientId);
      }
    }

    await this.visibility.assertCanLogTime(organisationId, membership, {
      taskId,
      projectId,
    });

    // R2-FIX 1 — billable:
    // - explicit dto.billable only if billable:set (admin/owner/PM override)
    // - else re-inherit when task/project changes
    // - else keep stored value (task flag changes do NOT retroactively rewrite lines)
    const taskOrProjectChanged =
      (dto.taskId !== undefined && dto.taskId !== existing.taskId) ||
      (dto.projectId !== undefined && dto.projectId !== existing.projectId);

    let billable = existing.billable;
    if (dto.billable !== undefined) {
      const projectForBillable = projectId;
      if (!projectForBillable) {
        throw new BadRequestException(
          'Cannot set billable without a project on the line',
        );
      }
      await this.visibility.assertCanSetBillable(
        organisationId,
        membership,
        projectForBillable,
      );
      billable = dto.billable;
    } else if (taskOrProjectChanged) {
      billable = await this.resolveInheritedBillable(
        organisationId,
        taskId,
        projectId,
      );
    }

    if (mergedTicketType === 'cr' && mergedCrId) {
      await this.assertCrInOrg(organisationId, mergedCrId);
    }
    if (dto.ticketId) {
      await this.assertTicketInOrg(organisationId, dto.ticketId);
    }

    const nextDuration =
      dto.durationMinutes !== undefined
        ? dto.durationMinutes
        : existing.durationMinutes;
    await this.assertWithinProjectBudget(
      organisationId,
      projectId,
      nextDuration,
      existing.id,
    );

    try {
      const result = await this.prisma.timeLine.updateMany({
        where: { id: existing.id, organisationId },
        data: {
          taskId,
          projectId,
          clientId,
          billable,
          ...(dto.ticketId !== undefined ? { ticketId: dto.ticketId } : {}),
          ...(dto.ticketType !== undefined
            ? { ticketType: dto.ticketType }
            : {}),
          ...(dto.area !== undefined ? { area: dto.area } : {}),
          ...(dto.crId !== undefined ? { crId: dto.crId } : {}),
          ...(dto.crNumber !== undefined ? { crNumber: dto.crNumber } : {}),
          ...(dto.durationMinutes !== undefined
            ? { durationMinutes: dto.durationMinutes }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Time line not found');
      }

      const updated = await this.findMutableLineOrThrow(
        organisationId,
        membership,
        userId,
        lineId,
      );

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: LINE_ENTITY,
        entityId: updated.id,
        action: 'update',
        oldValue: this.lineAudit(existing),
        newValue: this.lineAudit(updated),
      });

      return updated;
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

  async deleteLine(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    lineId: string,
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.findMutableLineOrThrow(
      organisationId,
      membership,
      userId,
      lineId,
    );
    const parentEntry = await this.prisma.timeEntry.findFirst({
      where: { id: existing.timeEntryId, organisationId },
    });
    if (!parentEntry) {
      throw new NotFoundException('Time entry not found');
    }
    await this.timesheets.assertEntryUnlocked(organisationId, parentEntry);

    const siblingCount = await this.prisma.timeLine.count({
      where: {
        organisationId,
        timeEntryId: existing.timeEntryId,
      },
    });

    if (siblingCount <= 1) {
      throw new BadRequestException(
        'Cannot delete the only line on a time entry — every entry must keep at least one line',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.timeLine.deleteMany({
          where: { id: existing.id, organisationId },
        });

        if (existing.isFirstLine) {
          const next = await tx.timeLine.findFirst({
            where: {
              organisationId,
              timeEntryId: existing.timeEntryId,
            },
            orderBy: { createdAt: 'asc' },
          });
          if (next) {
            await tx.timeLine.updateMany({
              where: { id: next.id, organisationId },
              data: { isFirstLine: true },
            });
          }
        }
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: LINE_ENTITY,
        entityId: existing.id,
        action: 'delete',
        oldValue: this.lineAudit(existing),
        newValue: null,
      });

      return { deleted: true, id: existing.id };
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

  private async resolveLineInput(
    organisationId: string,
    dto: TimeLineInputDto,
  ): Promise<ResolvedLineFields> {
    if (dto.durationMinutes < 1) {
      throw new BadRequestException('durationMinutes must be > 0');
    }

    if (dto.ticketType === 'cr') {
      if (!dto.crId || !dto.crNumber) {
        throw new BadRequestException(
          'crId and crNumber are required when ticketType is cr',
        );
      }
      await this.assertCrInOrg(organisationId, dto.crId);
    }

    if (dto.ticketId) {
      await this.assertTicketInOrg(organisationId, dto.ticketId);
    }

    let taskId: string | null = dto.taskId ?? null;
    let projectId: string | null = dto.projectId ?? null;
    let clientId: string | null = dto.clientId ?? null;

    if (dto.taskId) {
      const fromTask = await this.resolveFromTask(organisationId, dto.taskId);
      taskId = fromTask.taskId;
      projectId = fromTask.projectId;
      clientId = fromTask.clientId;
    } else {
      if (dto.projectId) {
        await this.assertProjectInOrg(organisationId, dto.projectId);
      }
      if (dto.clientId) {
        await this.assertClientInOrg(organisationId, dto.clientId);
      }
    }

    // FIX 5 — inherit billable from task → project; ignore client-sent flag
    const billable = await this.resolveInheritedBillable(
      organisationId,
      taskId,
      projectId,
    );

    return {
      taskId,
      projectId,
      clientId,
      ticketId: dto.ticketId ?? null,
      ticketType: dto.ticketType ?? null,
      area: dto.area ?? null,
      crId: dto.crId ?? null,
      crNumber: dto.crNumber ?? null,
      durationMinutes: dto.durationMinutes,
      billable,
      description: dto.description ?? null,
    };
  }

  /**
   * R2-FIX 1 / FIX 5 — inherit for new lines:
   * task.billable → else project.billableByDefault → else false.
   * Client-sent billable on create is ignored (see resolveLineInput).
   */
  private async resolveInheritedBillable(
    organisationId: string,
    taskId: string | null,
    projectId: string | null,
  ): Promise<boolean> {
    if (taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, organisationId },
        select: {
          billable: true,
          project: { select: { billableByDefault: true } },
        },
      });
      if (task) {
        return task.billable;
      }
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organisationId },
        select: { billableByDefault: true },
      });
      if (project) {
        return project.billableByDefault;
      }
    }

    return false;
  }

  private async resolveFromTask(
    organisationId: string,
    taskId: string,
  ): Promise<{
    taskId: string;
    projectId: string;
    clientId: string;
  }> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organisationId },
      include: { project: { select: { id: true, clientId: true } } },
    });

    if (!task) {
      throw new BadRequestException('taskId must belong to your organisation');
    }

    return {
      taskId: task.id,
      projectId: task.projectId,
      clientId: task.project.clientId,
    };
  }

  /**
   * FIX 4 — mutate only own entries unless time_entry:edit scope is `all`.
   */
  private async findMutableEntryOrThrow(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    id: string,
  ): Promise<EntryWithLines> {
    const scope = scopeFor(membership.permissions, 'time_entry', 'edit');
    if (!scope) {
      throw new ForbiddenException('You cannot edit time entries');
    }

    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        id,
        organisationId,
        ...(scope === 'all' ? {} : { userId }),
      },
      include: { timeLines: { orderBy: { createdAt: 'asc' } } },
    });

    if (!entry) {
      throw new NotFoundException('Time entry not found');
    }

    if (scope !== 'all' && entry.userId !== userId) {
      throw new ForbiddenException('You can only edit your own time entries');
    }

    return entry;
  }

  private async findMutableLineOrThrow(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
    lineId: string,
  ): Promise<TimeLine> {
    const scope = scopeFor(membership.permissions, 'time_entry', 'edit');
    if (!scope) {
      throw new ForbiddenException('You cannot edit time entries');
    }

    const line = await this.prisma.timeLine.findFirst({
      where: {
        id: lineId,
        organisationId,
        timeEntry: {
          organisationId,
          ...(scope === 'all' ? {} : { userId }),
        },
      },
    });

    if (!line) {
      throw new NotFoundException('Time line not found');
    }

    return line;
  }

  private assertNotFutureDate(entryDate: string): void {
    const day = entryDate.slice(0, 10);
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;
    if (day > todayKey) {
      throw new BadRequestException(
        'Cannot log time for a future date',
      );
    }
  }

  /**
   * FIX 2 — reject overlapping closed [start, end) ranges for the same user/day.
   * Open timers (endTime null) are ignored. Touching endpoints (end === next start) are OK.
   */
  private async assertNoTimeOverlap(
    organisationId: string,
    userId: string,
    entryDate: string,
    startTime: Date,
    endTime: Date,
    excludeEntryId?: string,
  ): Promise<void> {
    if (!(startTime < endTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const dayStart = new Date(`${entryDate.slice(0, 10)}T00:00:00.000Z`);
    const dayEnd = new Date(`${entryDate.slice(0, 10)}T23:59:59.999Z`);

    const others = await this.prisma.timeEntry.findMany({
      where: {
        organisationId,
        userId,
        entryDate: { gte: dayStart, lte: dayEnd },
        startTime: { not: null },
        endTime: { not: null },
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
      select: { id: true, startTime: true, endTime: true },
    });

    for (const other of others) {
      if (!other.startTime || !other.endTime) continue;
      // overlap if start < other.end && end > other.start (half-open friendly)
      if (startTime < other.endTime && endTime > other.startTime) {
        const fmt = (d: Date) =>
          d.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          });
        throw new BadRequestException(
          `overlaps an existing entry ${fmt(other.startTime)}–${fmt(other.endTime)}`,
        );
      }
    }
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
   * Phase2 FIX2 — logged minutes on a project cannot exceed budgetHours.
   * Null budget = unlimited. excludeLineId omits the line being edited/stopped.
   */
  private async assertWithinProjectBudget(
    organisationId: string,
    projectId: string | null | undefined,
    additionalMinutes: number,
    excludeLineId?: string,
  ): Promise<void> {
    if (!projectId) return;
    const mins = Number(additionalMinutes);
    if (!Number.isFinite(mins) || mins <= 0) return;

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organisationId },
      select: { budgetHours: true, name: true },
    });
    if (!project?.budgetHours) return;

    const budgetHours = Number(project.budgetHours);
    if (!Number.isFinite(budgetHours) || budgetHours <= 0) return;
    const budgetMinutes = Math.round(budgetHours * 60);

    const agg = await this.prisma.timeLine.aggregate({
      where: {
        organisationId,
        projectId,
        ...(excludeLineId ? { id: { not: excludeLineId } } : {}),
      },
      _sum: { durationMinutes: true },
    });
    const used = agg._sum.durationMinutes ?? 0;
    const total = used + mins;
    const remaining = Math.max(0, budgetMinutes - used);

    if (total > budgetMinutes) {
      throw new BadRequestException(
        `Time exceeds project budget for "${project.name}". ` +
          `Budget ${budgetHours}h (${budgetMinutes}m), already logged ${used}m, remaining ${remaining}m, this entry ${mins}m.`,
      );
    }
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

  private async assertTicketInOrg(
    organisationId: string,
    ticketId: string,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organisationId },
      select: { id: true },
    });
    if (!ticket) {
      throw new BadRequestException(
        'ticketId must belong to your organisation',
      );
    }
  }

  private async assertCrInOrg(
    organisationId: string,
    crId: string,
  ): Promise<void> {
    const cr = await this.prisma.changeRequest.findFirst({
      where: { id: crId, organisationId },
      select: { id: true },
    });
    if (!cr) {
      throw new BadRequestException('crId must belong to your organisation');
    }
  }

  private entryAudit(entry: EntryWithLines): Prisma.InputJsonValue {
    return {
      id: entry.id,
      organisationId: entry.organisationId,
      userId: entry.userId,
      entryDate: entry.entryDate.toISOString(),
      startTime: entry.startTime?.toISOString() ?? null,
      endTime: entry.endTime?.toISOString() ?? null,
      status: entry.status,
      source: entry.source,
      lineCount: entry.timeLines?.length ?? 0,
    };
  }

  private lineAudit(line: TimeLine): Prisma.InputJsonValue {
    return {
      id: line.id,
      timeEntryId: line.timeEntryId,
      taskId: line.taskId,
      projectId: line.projectId,
      clientId: line.clientId,
      ticketType: line.ticketType,
      crId: line.crId,
      crNumber: line.crNumber,
      durationMinutes: line.durationMinutes,
      billable: line.billable,
      isFirstLine: line.isFirstLine,
    };
  }
}
