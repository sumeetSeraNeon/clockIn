import { InternalServerErrorException } from '@nestjs/common';

/**
 * Use this (or @CurrentOrg()) before any tenant-owned Prisma query.
 * organisationId must come from FirebaseAuthGuard → membership — never from
 * body / params / query.
 */
export function requireOrganisationId(
  organisationId: string | undefined | null,
): string {
  if (!organisationId) {
    throw new InternalServerErrorException(
      'organisationId is missing from the auth context. Protect the route with FirebaseAuthGuard and never trust a client-supplied organisationId.',
    );
  }
  return organisationId;
}
