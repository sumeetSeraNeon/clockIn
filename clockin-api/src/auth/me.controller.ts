import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthMembership } from './auth.types';
import { CurrentMembership } from './decorators/current-membership.decorator';
import { CurrentOrg } from './decorators/current-org.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { formatRoleLabel, highestRoleName, scopeFor } from './permissions';

@Controller()
@UseGuards(FirebaseAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async getMe(
    @CurrentUser() user: User,
    @CurrentMembership() membership: AuthMembership,
    @CurrentOrg() organisationId: string,
  ) {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { id: true, name: true, code: true, currency: true },
    });

    const roleNames = membership.roles.map((r) => r.name);
    const highestRole = highestRoleName(roleNames);

    /** Convenience map: "project:view" → "managed" — for clients & FIX 3. */
    const permissionScopes: Record<string, string> = {};
    for (const p of membership.permissions) {
      const scope = scopeFor(membership.permissions, p.resource, p.action);
      if (scope) {
        permissionScopes[`${p.resource}:${p.action}`] = scope;
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firebaseUid: user.firebaseUid,
        authProvider: user.authProvider,
        status: user.status,
      },
      membership: {
        id: membership.id,
        organisationId: membership.organisationId,
        memberType: membership.memberType,
        department: membership.department,
        status: membership.status,
      },
      organisation: organisation
        ? {
            id: organisation.id,
            name: organisation.name,
            code: organisation.code,
            currency: organisation.currency,
          }
        : null,
      roles: membership.roles,
      highestRole,
      highestRoleLabel: formatRoleLabel(highestRole),
      permissions: membership.permissions,
      permissionScopes,
      organisationId,
    };
  }
}
