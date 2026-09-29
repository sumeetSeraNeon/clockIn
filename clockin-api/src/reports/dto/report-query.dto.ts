import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
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

const GROUP_BY = ['project', 'client', 'user', 'task', 'manager'] as const;

export class ReportSummaryQueryDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsOptional()
  @IsIn(GROUP_BY)
  groupBy?: (typeof GROUP_BY)[number] = 'project';

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}

export class ReportDetailedQueryDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

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
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  billable?: boolean;
}

export class ReportBudgetQueryDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsIn(['approved', 'pending', 'all'])
  entryStatus?: 'approved' | 'pending' | 'all' = 'approved';
}

export class ReportApprovalsQueryDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsOptional()
  @IsIn(['submitted', 'approved', 'rejected', 'all'])
  status?: 'submitted' | 'approved' | 'rejected' | 'all' = 'all';

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
