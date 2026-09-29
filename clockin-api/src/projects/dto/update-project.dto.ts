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
  ValidateIf,
} from 'class-validator';

const PROJECT_STATUSES = [
  'planned',
  'active',
  'on_hold',
  'completed',
  'archived',
] as const;

export class UpdateProjectDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: (typeof PROJECT_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetValue?: number | null;

  @IsOptional()
  @IsBoolean()
  billableByDefault?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(30)
  color?: string | null;
}
