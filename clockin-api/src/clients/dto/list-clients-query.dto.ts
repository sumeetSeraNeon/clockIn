import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination';

const CLIENT_STATUSES = ['active', 'inactive', 'archived'] as const;

export class ListClientsQueryDto {
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
  @IsIn(CLIENT_STATUSES)
  status?: (typeof CLIENT_STATUSES)[number];
}
