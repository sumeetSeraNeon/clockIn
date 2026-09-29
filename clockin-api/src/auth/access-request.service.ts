import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';
import { RequestAccessDto } from './dto/request-access.dto';

@Injectable()
export class AccessRequestService {
  constructor(private readonly prisma: PrismaService) {}

  async requestAccess(decoded: DecodedIdToken, dto: RequestAccessDto) {
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException(
        'Firebase token is missing an email claim',
      );
    }

    const orgCode = dto.organisationCode.trim().toUpperCase();
    const org = await this.prisma.organisation.findFirst({
      where: {
        code: { equals: orgCode, mode: 'insensitive' },
        status: 'active',
      },
      select: { id: true, name: true, code: true },
    });

    if (!org) {
      throw new BadRequestException(
        'Unknown organisation code. Ask your admin for the correct code.',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });
    }

    if (user?.status === 'disabled') {
      throw new ForbiddenException('This account has been disabled');
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name.trim(),
          status: 'invited',
          firebaseUid: decoded.uid,
          authProvider: 'firebase',
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: dto.name.trim() || user.name,
          firebaseUid: decoded.uid,
          authProvider: 'firebase',
          // Keep active users active; everyone else waits as invited.
          ...(user.status === 'active' ? {} : { status: 'invited' }),
        },
      });
    }

    const existing = await this.prisma.membership.findUnique({
      where: {
        organisationId_userId: {
          organisationId: org.id,
          userId: user.id,
        },
      },
    });

    if (existing) {
      if (existing.status === 'active') {
        throw new BadRequestException(
          'You already have access to this organisation. Sign in instead.',
        );
      }
      if (existing.status === 'pending') {
        return {
          status: 'pending' as const,
          organisation: org,
          message:
            'Your access request is already pending. An admin must approve it before you can sign in.',
        };
      }
      // Reactivate a deactivated membership as a fresh request.
      await this.prisma.membership.update({
        where: { id: existing.id },
        data: {
          status: 'pending',
          department: dto.department?.trim() || existing.department,
        },
      });
      if (user.status !== 'active') {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { status: 'invited' },
        });
      }
      return {
        status: 'pending' as const,
        organisation: org,
        message:
          'Access request submitted. An admin must approve it before you can sign in.',
      };
    }

    await this.prisma.membership.create({
      data: {
        organisationId: org.id,
        userId: user.id,
        memberType: 'staff',
        department: dto.department?.trim() || null,
        status: 'pending',
      },
    });

    return {
      status: 'pending' as const,
      organisation: org,
      message:
        'Access request submitted. An admin must approve it before you can sign in.',
    };
  }
}
