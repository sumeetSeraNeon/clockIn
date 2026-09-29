import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

const RATE_TYPES = ['cost', 'billable'] as const;

/**
 * Resolve the most-specific applicable rate for a work context on a date.
 * Prefer passing timeLineId; otherwise pass the denormalized ids + date.
 */
export class LookupRateDto {
  @IsIn(RATE_TYPES)
  rateType!: (typeof RATE_TYPES)[number];

  /** Date the work happened (YYYY-MM-DD or ISO datetime) */
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  timeLineId?: string;

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
