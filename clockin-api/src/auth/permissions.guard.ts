import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  REQUIRE_PERMISSION_KEY,
  type RequiredPermission,
} from './decorators/require-permission.decorator';
import { can } from './permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      RequiredPermission | undefined
    >(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    // Endpoints without @RequirePermission stay auth+org-scoped only.
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const membership = request.membership;
    if (!membership) {
      throw new ForbiddenException('No active membership on request');
    }

    if (!can(membership.permissions, required.resource, required.action)) {
      throw new ForbiddenException(
        `Missing permission ${required.resource}:${required.action}`,
      );
    }

    return true;
  }
}
