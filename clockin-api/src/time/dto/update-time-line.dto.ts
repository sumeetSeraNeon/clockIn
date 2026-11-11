import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const AREAS = ['functional', 'technical', 'integration', 'pm'] as const;

export class UpdateTimeLineDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  taskId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  clientId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  ticketId?: string | null;

  /** Ignored when ticketId is set — server derives from ticket. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(50)
  ticketType?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(AREAS)
  area?: string | null;

  /** Deprecated — cleared on write. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  crId?: string | null;

  /** Deprecated — cleared on write. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(50)
  crNumber?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  /** R2-FIX 1 — members ignored; billable:set may override via PATCH (see updateLine). */
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(10000)
  description?: string | null;
}
