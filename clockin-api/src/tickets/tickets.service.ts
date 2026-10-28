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
import { TICKET_STATUSES } from './ticket.constants';

const ENTITY_TYPE = 'ticket';

const ticketInclude = {
  department: { select: { id: true, name: true, status: true } },
} satisfies Prisma.TicketInclude;

type TicketWithDepartment = Prisma.TicketGetPayload<{
  include: typeof ticketInclude;
}>;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  /** Active departments for Freshdesk Group dropdown on tickets. */
  async listDepartments(organisationId: string) {
    const rows = await this.prisma.department.findMany({
      where: { organisationId, status: 'active' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, status: true },
    });
    return { data: rows };
  }

  async create(
    organisationId: string,
    actorMembershipId: string,
    dto: CreateTicketDto,
  ): Promise<TicketWithDepartment> {
    await this.assertClientInOrg(organisationId, dto.clientId);

    if (dto.projectId) {
      await this.assertProjectForClient(
        organisationId,
        dto.projectId,
        dto.clientId,
      );
    }
    if (dto.departmentId) {
      await this.assertDepartmentInOrg(organisationId, dto.departmentId);
    }

    const status = dto.status ?? 'open';
    this.assertAllowedStatus(status);

    const openedAt = dto.openedAt ? new Date(dto.openedAt) : new Date();
    const contactName = dto.contactName?.trim() || dto.raisedBy?.trim() || null;

    try {
      const ticket = await this.prisma.ticket.create({
        data: {
          organisationId,
          clientId: dto.clientId,
          projectId: dto.projectId,
          departmentId: dto.departmentId,
          reference: dto.reference.trim(),
          ticketType: dto.ticketType,
          title: dto.title,
          description: dto.description,
          status,
          priority: dto.priority,
          ticketPriority: dto.ticketPriority,
          raisedBy: dto.raisedBy?.trim() || contactName,
          agentName: dto.agentName?.trim() || null,
          internalAgentName: dto.internalAgentName?.trim() || null,
          contactName,
          contactEmail: dto.contactEmail?.trim() || null,
          contactExternalId: dto.contactExternalId?.trim() || null,
          source: dto.source?.trim() || null,
          tags: dto.tags?.trim() || null,
          workstream: dto.workstream?.trim() || null,
          openedAt,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          resolvedAt: dto.resolvedAt
            ? new Date(dto.resolvedAt)
            : status === 'resolved'
              ? new Date()
              : null,
          closedAt: dto.closedAt
            ? new Date(dto.closedAt)
            : status === 'closed'
              ? new Date()
              : null,
          initialResponseAt: dto.initialResponseAt
            ? new Date(dto.initialResponseAt)
            : null,
          firstResponseSeconds: dto.firstResponseSeconds ?? null,
          resolutionSeconds: dto.resolutionSeconds ?? null,
        },
        include: ticketInclude,
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
  ): Promise<PaginatedResult<TicketWithDepartment & { loggedMinutes: number }>> {
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
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ticketType ? { ticketType: query.ticketType } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };

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
          include: ticketInclude,
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
    TicketWithDepartment & {
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
      include: ticketInclude,
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
  ): Promise<TicketWithDepartment> {
    const existing = await this.findOwnedOrThrow(organisationId, id);

    if (dto.status) {
      this.assertAllowedStatus(dto.status);
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

    if (dto.departmentId) {
      await this.assertDepartmentInOrg(organisationId, dto.departmentId);
    }

    const data: Prisma.TicketUpdateManyMutationInput = {
      ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
      ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
      ...(dto.departmentId !== undefined
        ? { departmentId: dto.departmentId }
        : {}),
      ...(dto.ticketType !== undefined ? { ticketType: dto.ticketType } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.ticketPriority !== undefined
        ? { ticketPriority: dto.ticketPriority }
        : {}),
      ...(dto.raisedBy !== undefined ? { raisedBy: dto.raisedBy } : {}),
      ...(dto.agentName !== undefined ? { agentName: dto.agentName } : {}),
      ...(dto.internalAgentName !== undefined
        ? { internalAgentName: dto.internalAgentName }
        : {}),
      ...(dto.contactName !== undefined
        ? { contactName: dto.contactName }
        : {}),
      ...(dto.contactEmail !== undefined
        ? { contactEmail: dto.contactEmail }
        : {}),
      ...(dto.contactExternalId !== undefined
        ? { contactExternalId: dto.contactExternalId }
        : {}),
      ...(dto.source !== undefined ? { source: dto.source } : {}),
      ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
      ...(dto.workstream !== undefined ? { workstream: dto.workstream } : {}),
      ...(dto.dueAt !== undefined
        ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }
        : {}),
      ...(dto.closedAt !== undefined
        ? { closedAt: dto.closedAt ? new Date(dto.closedAt) : null }
        : {}),
      ...(dto.initialResponseAt !== undefined
        ? {
            initialResponseAt: dto.initialResponseAt
              ? new Date(dto.initialResponseAt)
              : null,
          }
        : {}),
      ...(dto.firstResponseSeconds !== undefined
        ? { firstResponseSeconds: dto.firstResponseSeconds }
        : {}),
      ...(dto.resolutionSeconds !== undefined
        ? { resolutionSeconds: dto.resolutionSeconds }
        : {}),
    };

    if (dto.status === 'resolved' && !existing.resolvedAt) {
      data.resolvedAt = new Date();
    }
    if (dto.status === 'closed' && !existing.closedAt) {
      data.closedAt = new Date();
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

  private assertAllowedStatus(status: string): void {
    if (!(TICKET_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(`Invalid ticket status: ${status}`);
    }
  }

  private async findOwnedOrThrow(
    organisationId: string,
    id: string,
  ): Promise<TicketWithDepartment> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organisationId },
      include: ticketInclude,
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

  private async assertDepartmentInOrg(
    organisationId: string,
    departmentId: string,
  ): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organisationId, status: 'active' },
      select: { id: true },
    });
    if (!department) {
      throw new BadRequestException(
        'departmentId must be an active department in your organisation',
      );
    }
  }

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

  private async attachLoggedMinutes<T extends Ticket>(
    organisationId: string,
    tickets: T[],
  ): Promise<Array<T & { loggedMinutes: number }>> {
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
      departmentId: ticket.departmentId,
      reference: ticket.reference,
      ticketType: ticket.ticketType,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      ticketPriority: ticket.ticketPriority,
      raisedBy: ticket.raisedBy,
      agentName: ticket.agentName,
      contactName: ticket.contactName,
      contactEmail: ticket.contactEmail,
      openedAt: ticket.openedAt?.toISOString() ?? null,
      dueAt: ticket.dueAt?.toISOString() ?? null,
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      closedAt: ticket.closedAt?.toISOString() ?? null,
    };
  }
}
