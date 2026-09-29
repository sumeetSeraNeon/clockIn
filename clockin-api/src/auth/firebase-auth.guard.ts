import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthMembership } from './auth.types';
import { mergePermissionGrants } from './permissions';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    let decoded;
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }

    const uid = decoded.uid;
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException(
        'Firebase token is missing an email claim',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { firebaseUid: uid },
    });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new ForbiddenException(
          'No ClockIn user exists for this email. Phase 1 users must be seeded or invited — they are not auto-created.',
        );
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: uid,
          authProvider: 'firebase',
        },
      });
    } else if (user.authProvider !== 'firebase') {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { authProvider: 'firebase' },
      });
    }

    if (user.status === 'disabled') {
      throw new ForbiddenException('User account is not active');
    }

    const pendingMembership = await this.prisma.membership.findFirst({
      where: { userId: user.id, status: 'pending' },
      select: { id: true },
    });

    // Admin invite pre-approves membership (status=active) while user stays
    // invited until first successful login — activate then.
    if (user.status === 'invited') {
      const preApproved = await this.prisma.membership.findFirst({
        where: { userId: user.id, status: 'active' },
        select: { id: true },
      });
      if (preApproved) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { status: 'active' },
        });
      } else if (pendingMembership) {
        throw new ForbiddenException(
          'Your access request is waiting for admin approval',
        );
      } else {
        throw new ForbiddenException('User account is not active');
      }
    } else if (user.status !== 'active') {
      throw new ForbiddenException('User account is not active');
    }

    const membershipRow = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        status: 'active',
      },
      include: {
        membershipRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: {
                  select: { resource: true, action: true, scope: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membershipRow) {
      if (pendingMembership) {
        throw new ForbiddenException(
          'Your access request is waiting for admin approval',
        );
      }
      throw new ForbiddenException(
        'User has no active organisation membership',
      );
    }

    const { membershipRoles, ...membershipFields } = membershipRow;
    const permissions = mergePermissionGrants(
      membershipRoles.flatMap((mr) =>
        mr.role.permissions.map((p) => ({
          resource: p.resource,
          action: p.action,
          scope: p.scope as AuthMembership['permissions'][number]['scope'],
        })),
      ),
    );

    const membership: AuthMembership = {
      ...membershipFields,
      roles: membershipRoles.map((mr) => ({
        id: mr.role.id,
        name: mr.role.name,
      })),
      permissions,
    };

    request.user = user;
    request.membership = membership;
    request.organisationId = membership.organisationId;

    return true;
  }

  private extractBearerToken(request: Request): string {
    const header = request.headers.authorization;
    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException(
        'Missing Authorization header (expected Bearer <Firebase ID token>)',
      );
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Malformed Authorization header (expected Bearer <Firebase ID token>)',
      );
    }

    return token;
  }
}
