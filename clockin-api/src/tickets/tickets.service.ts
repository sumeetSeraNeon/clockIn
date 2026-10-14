import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Ticket } from '@prisma/client';
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
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

const ENTITY_TYPE = 'ticket';

/** Forward-only status flow from the API task plan. */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed'],
  closed: [],
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  async create(
    organisationId: string,
    actorMembershipId: string,
    dto: CreateTicketDto,
  ): Promise<Ticket> {
    await this.assertClientInOrg(organisationId, dto.clientId);

    if (dto.projectId) {
      await this.assertProjectForClient(
        organisationId,
        dto.projectId,
        dto.clientId,
      );
    }

    try {
      const ticket = await this.prisma.ticket.create({
        data: {
          organisationId,
          clientId: dto.clientId,
          projectId: dto.projectId,
          reference: dto.reference.trim(),
          ticketType: dto.ticketType,
          title: dto.title,
          description: dto.description,
          status: 'open',
          priority: dto.priority,
          raisedBy: dto.raisedBy,
          openedAt: new Date(),
        },
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: ticket.id,
        action: 'create',
        oldValue: null,
        newValue: this.toAuditJson(ticket),
      });

      return ticket;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAll(
    organisationId: string,
    membership: AuthMembership,
    query: ListTicketsQueryDto,
  ): Promise<PaginatedResult<Ticket & { loggedMinutes: number }>> {
    const { page, pageSize, skip, take } = resolvePagination(query);

    if (query.clientId) {
      await this.assertClientInOrg(organisationId, query.clientId);
    }
    if (query.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: query.projectId, organisationId },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
    }

    const visibilityWhere = await this.visibility.ticketWhere(
      organisationId,
      membership,
    );

    const where: Prisma.TicketWhereInput = {
      organisationId,
      ...visibilityWhere,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ticketType ? { ticketType: query.ticketType } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };

    // Use AND so we do not overwrite visibilityWhere.OR (managed scope).
    const q = query.q?.trim();
    if (q) {
      where.AND = [
        {
          OR: [
            { reference: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    try {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.ticket.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        this.prisma.ticket.count({ where }),
      ]);

      const withLogged = await this.attachLoggedMinutes(organisationId, data);
      return buildPaginatedResult(withLogged, total, page, pageSize);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findOne(
    organisationId: string,
    membership: AuthMembership,
    id: string,
  ): Promise<
    Ticket & {
      loggedMinutes: number;
      minutesByStatus: {
        submitted: number;
        approved: number;
      };
      timeEntries: Array<{
        lineId: string;
        entryId: string;
        userId: string;
        userName: string;
        entryDate: string;
        startTime: string | null;
        endTime: string | null;
        durationMinutes: number;
        taskName: string | null;
        description: string | null;
        status: string;
      }>;
    }
  > {
    const visibilityWhere = await this.visibility.ticketWhere(
      organisationId,
      membership,
    );
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organisationId, ...visibilityWhere },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    const [loggedMinutes, activity] = await Promise.all([
      this.sumLoggedMinutes(organisationId, ticket.id),
      this.loadTicketTimeActivity(organisationId, ticket.id),
    ]);
    return {
      ...ticket,
      loggedMinutes,
      minutesByStatus: activity.minutesByStatus,
      timeEntries: activity.timeEntries,
    };
  }

  async update(
    organisationId: string,
    actorMembershipId: string,
    id: string,
    dto: UpdateTicketDto,
  ): Promise<Ticket> {
    const existing = await this.findOwnedOrThrow(organisationId, id);

    if (dto.status && dto.status !== existing.status) {
      this.assertStatusTransition(existing.status, dto.status);
    }

    const nextClientId = dto.clientId ?? existing.clientId;

    if (dto.clientId) {
      await this.assertClientInOrg(organisationId, dto.clientId);
    }

    if (dto.projectId) {
      await this.assertProjectForClient(
        organisationId,
        dto.projectId,
        nextClientId,
      );
    }

    const data: Prisma.TicketUpdateManyMutationInput = {
      ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
      ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.raisedBy !== undefined ? { raisedBy: dto.raisedBy } : {}),
    };

    if (dto.status === 'resolved' && !existing.resolvedAt) {
      data.resolvedAt = new Date();
    }

    try {
      const result = await this.prisma.ticket.updateMany({
        where: { id: existing.id, organisationId },
        data,
      });

      if (result.count === 0) {
        throw new NotFoundException('Ticket not found');
      }

      const ticket = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: ticket.id,
        action: 'update',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(ticket),
      });

      return ticket;
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

  private assertStatusTransition(from: string, to: string): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} → ${to}. Allowed: open → in_progress → resolved → closed`,
      );
    }
  }

  private async findOwnedOrThrow(
    organisationId: string,
    id: string,
  ): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organisationId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
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

  private async assertProjectForClient(
    organisationId: string,
    projectId: string,
    clientId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organisationId, clientId },
      select: { id: true },
    });

    if (!project) {
      throw new BadRequestException(
        'projectId must belong to your organisation and the same client',
      );
    }
  }

  /**
   * Approved minutes only, and only lines where this ticket was selected.
   */
  private async sumLoggedMinutes(
    organisationId: string,
    ticketId: string,
  ): Promise<number> {
    const agg = await this.prisma.timeLine.aggregate({
      where: { organisationId, ticketId, status: 'approved' },
      _sum: { durationMinutes: true },
    });
    return agg._sum.durationMinutes ?? 0;
  }

  private async attachLoggedMinutes(
    organisationId: string,
    tickets: Ticket[],
  ): Promise<Array<Ticket & { loggedMinutes: number }>> {
    if (tickets.length === 0) return [];
    const sums = await this.prisma.timeLine.groupBy({
      by: ['ticketId'],
      where: {
        organisationId,
        ticketId: { in: tickets.map((t) => t.id) },
        status: 'approved',
      },
      _sum: { durationMinutes: true },
    });
    const byId = new Map(
      sums
        .filter((s) => s.ticketId)
        .map((s) => [s.ticketId as string, s._sum.durationMinutes ?? 0]),
    );
    return tickets.map((t) => ({
      ...t,
      loggedMinutes: byId.get(t.id) ?? 0,
    }));
  }

  /**
   * Linked lines only — submitted + approved (draft/rejected hidden).
   */
  private async loadTicketTimeActivity(
    organisationId: string,
    ticketId: string,
  ): Promise<{
    minutesByStatus: {
      submitted: number;
      approved: number;
    };
    timeEntries: Array<{
      lineId: string;
      entryId: string;
      userId: string;
      userName: string;
      entryDate: string;
      startTime: string | null;
      endTime: string | null;
      durationMinutes: number;
      taskName: string | null;
      description: string | null;
      status: string;
    }>;
  }> {
    const lines = await this.prisma.timeLine.findMany({
      where: {
        organisationId,
        ticketId,
        status: { in: ['submitted', 'approved'] },
      },
      include: {
        task: { select: { name: true } },
        timeEntry: {
          select: {
            id: true,
            userId: true,
            entryDate: true,
            startTime: true,
            endTime: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const minutesByStatus = {
      submitted: 0,
      approved: 0,
    };

    const timeEntries = lines.map((line) => {
      const status = line.status || 'submitted';
      const mins = line.durationMinutes ?? 0;
      if (status === 'submitted') minutesByStatus.submitted += mins;
      else if (status === 'approved') minutesByStatus.approved += mins;

      const user = line.timeEntry.user;
      return {
        lineId: line.id,
        entryId: line.timeEntry.id,
        userId: line.timeEntry.userId,
        userName: user?.name?.trim() || user?.email || 'Unknown',
        entryDate: line.timeEntry.entryDate.toISOString().slice(0, 10),
        startTime: line.timeEntry.startTime?.toISOString() ?? null,
        endTime: line.timeEntry.endTime?.toISOString() ?? null,
        durationMinutes: mins,
        taskName: line.task?.name ?? null,
        description: line.description?.trim() || null,
        status,
      };
    });

    return { minutesByStatus, timeEntries };
  }

  private toAuditJson(ticket: Ticket): Prisma.InputJsonValue {
    return {
      id: ticket.id,
      organisationId: ticket.organisationId,
      clientId: ticket.clientId,
      projectId: ticket.projectId,
      reference: ticket.reference,
      ticketType: ticket.ticketType,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      raisedBy: ticket.raisedBy,
      openedAt: ticket.openedAt?.toISOString() ?? null,
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    };
  }
}
