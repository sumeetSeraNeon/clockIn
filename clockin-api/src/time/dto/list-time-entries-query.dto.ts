import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination';

export class ListTimeEntriesQueryDto {
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

  /** Inclusive start date (YYYY-MM-DD) */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** Inclusive end date (YYYY-MM-DD) */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Entries that have at least one line against this task */
  @IsOptional()
  @IsUUID()
  taskId?: string;
}
