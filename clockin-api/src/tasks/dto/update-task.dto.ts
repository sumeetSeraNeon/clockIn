import { Type } from 'class-transformer';
import {
  IsBoolean,
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

const TASK_STATUSES = ['open', 'done', 'archived'] as const;

export class UpdateTaskDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedHours?: number | null;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}
