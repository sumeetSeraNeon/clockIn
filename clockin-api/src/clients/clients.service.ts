import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Client, Prisma } from '@prisma/client';
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
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const ENTITY_TYPE = 'client';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  async create(
    organisationId: string,
    actorMembershipId: string,
    dto: CreateClientDto,
  ): Promise<Client> {
    if (dto.ownerId) {
      await this.assertOwnerInOrg(organisationId, dto.ownerId);
    }

    try {
      const client = await this.prisma.client.create({
        data: {
          organisationId,
          name: dto.name,
          code: dto.code,
          currency: dto.currency,
          ownerId: dto.ownerId,
          status: dto.status ?? 'active',
          externalRef: dto.externalRef,
        },
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: client.id,
        action: 'create',
        oldValue: null,
        newValue: this.toAuditJson(client),
      });

      return client;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAll(
    organisationId: string,
    membership: AuthMembership,
    query: ListClientsQueryDto,
  ): Promise<PaginatedResult<Client>> {
    const { page, pageSize, skip, take } = resolvePagination(query);

    const visibilityWhere = await this.visibility.clientWhere(
      organisationId,
      membership,
    );

    const where: Prisma.ClientWhereInput = {
      organisationId,
      ...visibilityWhere,
      ...(query.status ? { status: query.status } : {}),
    };

    try {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.client.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        this.prisma.client.count({ where }),
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
  ): Promise<Client> {
    const visibilityWhere = await this.visibility.clientWhere(
      organisationId,
      membership,
    );
    const client = await this.prisma.client.findFirst({
      where: { id, organisationId, ...visibilityWhere },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async update(
    organisationId: string,
    actorMembershipId: string,
    id: string,
    dto: UpdateClientDto,
  ): Promise<Client> {
    const existing = await this.findOwnedOrThrow(organisationId, id);

    if (dto.ownerId) {
      await this.assertOwnerInOrg(organisationId, dto.ownerId);
    }

    try {
      const updated = await this.prisma.client.updateMany({
        where: { id: existing.id, organisationId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.externalRef !== undefined
            ? { externalRef: dto.externalRef }
            : {}),
          ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
        },
      });

      if (updated.count === 0) {
        throw new NotFoundException('Client not found');
      }

      const client = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: client.id,
        action: 'update',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(client),
      });

      return client;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  async archive(
    organisationId: string,
    actorMembershipId: string,
    id: string,
  ): Promise<Client> {
    const existing = await this.findOwnedOrThrow(organisationId, id);

    if (existing.status === 'archived') {
      return existing;
    }

    try {
      const result = await this.prisma.client.updateMany({
        where: { id: existing.id, organisationId },
        data: { status: 'archived' },
      });

      if (result.count === 0) {
        throw new NotFoundException('Client not found');
      }

      const archived = await this.findOwnedOrThrow(organisationId, id);

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId,
        entityType: ENTITY_TYPE,
        entityId: archived.id,
        action: 'archive',
        oldValue: this.toAuditJson(existing),
        newValue: this.toAuditJson(archived),
      });

      return archived;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      mapPrismaError(error);
    }
  }

  /**
   * Org-scoped fetch. Missing OR other-org → identical 404 (no leak).
   */
  private async findOwnedOrThrow(
    organisationId: string,
    id: string,
  ): Promise<Client> {
    const client = await this.prisma.client.findFirst({
      where: { id, organisationId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
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

  private toAuditJson(client: Client): Prisma.InputJsonValue {
    return {
      id: client.id,
      organisationId: client.organisationId,
      name: client.name,
      code: client.code,
      currency: client.currency,
      ownerId: client.ownerId,
      status: client.status,
      externalRef: client.externalRef,
    };
  }
}
