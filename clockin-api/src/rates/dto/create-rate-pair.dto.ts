import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * STEP 2 — set cost + billable together for one project + person (project_user scope).
 */
export class CreateRatePairDto {
  @IsUUID()
  projectId!: string;

  /** User id (not membership id) — same as Rate.userId */
  @IsUUID()
  userId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costAmount!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  billableAmount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO code (e.g. GBP)',
  })
  currency?: string;

  @IsDateString()
  effectiveFrom!: string;
}
