import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Default / max page sizes for every list endpoint. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsString()
  status?: string;
}

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: PaginationMeta;
};

export function resolvePagination(query: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number; skip: number; take: number } {
  const page = query.page ?? DEFAULT_PAGE;
  let pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

  if (page < 1) {
    throw new BadRequestException('page must be >= 1');
  }
  if (pageSize < 1) {
    throw new BadRequestException('pageSize must be >= 1');
  }
  if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
  }

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}
