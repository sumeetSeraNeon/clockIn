import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthMembership } from '../auth/auth.types';
import { highestRoleName } from '../auth/permissions';
import { mapPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';

const ENTITY_TYPE = 'organisation';

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(organisationId: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { id: true, name: true, code: true, currency: true },
    });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }
    return org;
  }

  /**
   * FIX 3 — owner/admin set organisation default currency (Settings).
   */
  async update(
    organisationId: string,
    membership: AuthMembership,
    dto: UpdateOrganisationDto,
  ) {
    const role = highestRoleName(membership.roles.map((r) => r.name));
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenException(
        'Only owners and admins can change organisation settings',
      );
    }

    const existing = await this.get(organisationId);

    try {
      const updated = await this.prisma.organisation.update({
        where: { id: organisationId },
        data: {
          ...(dto.currency !== undefined
            ? { currency: dto.currency.toUpperCase() }
            : {}),
        },
        select: { id: true, name: true, code: true, currency: true },
      });

      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: ENTITY_TYPE,
        entityId: organisationId,
        action: 'update',
        oldValue: existing,
        newValue: updated,
      });

      return updated;
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
