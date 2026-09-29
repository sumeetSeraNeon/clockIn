import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type WriteAuditInput = {
  organisationId: string;
  actorMembershipId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
};

/**
 * Append-only audit writer. Every create/update/archive of an important
 * entity should call this. Never update or delete audit_events rows.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async writeAudit(input: WriteAuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        organisationId: input.organisationId,
        actorId: input.actorMembershipId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue:
          input.oldValue === undefined
            ? undefined
            : (input.oldValue as Prisma.InputJsonValue),
        newValue:
          input.newValue === undefined
            ? undefined
            : (input.newValue as Prisma.InputJsonValue),
      },
    });
  }
}
