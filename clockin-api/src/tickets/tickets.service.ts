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
  ): Promise<PaginatedResult<Ticket>> {
    const { page, pageSize, skip, take } = resolvePagination(query);

    if (query.clientId) {
      await this.assertClientInOrg(organisationId, query.clientId);
    }

    const visibilityWhere = await this.visibility.ticketWhere(
      organisationId,
      membership,
    );

    const where: Prisma.TicketWhereInput = {
      organisationId,
      ...visibilityWhere,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ticketType ? { ticketType: query.ticketType } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };

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

      return buildPaginatedResult(data, total, page, pageSize);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findOne(
    organisationId: string,
    membership: AuthMembership,
    id: string,
  ): Promise<Ticket> {
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
    return ticket;
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
