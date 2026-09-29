import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination';

const PROJECT_STATUSES = [
  'planned',
  'active',
  'on_hold',
  'completed',
  'archived',
] as const;

export class ListProjectsQueryDto {
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
  @IsIn(PROJECT_STATUSES)
  status?: (typeof PROJECT_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
