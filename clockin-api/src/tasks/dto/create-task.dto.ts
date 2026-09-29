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
} from 'class-validator';

const TASK_STATUSES = ['open', 'done', 'archived'] as const;

export class CreateTaskDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];

  /** Assignee membership id (must belong to the same org). */
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}
