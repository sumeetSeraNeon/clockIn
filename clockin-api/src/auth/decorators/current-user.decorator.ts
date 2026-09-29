import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return request.user;
  },
);
