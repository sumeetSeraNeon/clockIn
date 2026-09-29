import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Map known Prisma failures to Nest HTTP exceptions.
 * Never leak raw Prisma messages/stack to the client.
 */
export function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new NotFoundException('Resource not found');
    }
    if (error.code === 'P2002') {
      throw new BadRequestException('A record with that unique value already exists');
    }
    if (error.code === 'P2003') {
      throw new BadRequestException('Related record does not exist or is invalid');
    }
  }

  throw new InternalServerErrorException('Unexpected database error');
}
