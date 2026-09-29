import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const PROJECT_STATUSES = [
  'planned',
  'active',
  'on_hold',
  'completed',
  'archived',
] as const;

export class CreateProjectDto {
  @IsUUID()
  clientId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  /** Project manager membership id (must belong to the same org). */
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: (typeof PROJECT_STATUSES)[number];

  /** Decimal money/hours — sent as number; stored as Prisma Decimal. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetValue?: number;

  @IsOptional()
  @IsBoolean()
  billableByDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;
}
