import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import { requireOrganisationId } from '../tenancy';

/**
 * Injects organisationId from the authenticated membership only.
 * Example: findMany({ where: { organisationId: orgId } })
 */
export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    try {
      return requireOrganisationId(request.organisationId);
    } catch {
      throw new InternalServerErrorException(
        'organisationId is missing from the auth context. Protect the route with FirebaseAuthGuard.',
      );
    }
  },
);
