import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** GET /timesheets/approvals-log — org-wide history for admin/owner. */
export class ApprovalsLogQueryDto {
  @IsOptional()
  @IsIn(['submitted', 'approved', 'rejected', 'all'])
  status?: 'submitted' | 'approved' | 'rejected' | 'all';

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  /** Case-insensitive match on requester name/email or project name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
