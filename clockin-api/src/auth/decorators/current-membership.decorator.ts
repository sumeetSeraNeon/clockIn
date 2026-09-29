import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthMembership } from '../auth.types';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthMembership => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.membership) {
      throw new UnauthorizedException('No active membership on this request');
    }
    return request.membership;
  },
);
