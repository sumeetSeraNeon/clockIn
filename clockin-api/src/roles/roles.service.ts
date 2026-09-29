import { Injectable } from '@nestjs/common';
import { SYSTEM_ROLE_NAMES } from '../auth/permission-matrix';
import { mapPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_ORDER = new Map(
  SYSTEM_ROLE_NAMES.map((name, index) => [name, index]),
);

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organisationId: string) {
    try {
      const roles = await this.prisma.role.findMany({
        where: { organisationId },
        select: { id: true, name: true },
      });

      return roles.sort((a, b) => {
        const oa = ROLE_ORDER.get(a.name as (typeof SYSTEM_ROLE_NAMES)[number]);
        const ob = ROLE_ORDER.get(b.name as (typeof SYSTEM_ROLE_NAMES)[number]);
        if (oa != null && ob != null) return oa - ob;
        if (oa != null) return -1;
        if (ob != null) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
