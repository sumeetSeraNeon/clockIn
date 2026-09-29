import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const TICKET_TYPES = ['incident', 'cr', 'sr'] as const;
const AREAS = ['functional', 'technical', 'integration', 'pm'] as const;
const SOURCES = ['timer', 'manual', 'api'] as const;

/** Shared line payload for create-entry (first line) and add-line. */
export class TimeLineInputDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsOptional()
  @IsIn(TICKET_TYPES)
  ticketType?: (typeof TICKET_TYPES)[number];

  @IsOptional()
  @IsIn(AREAS)
  area?: string;

  /** Required when ticketType = cr */
  @ValidateIf((o: TimeLineInputDto) => o.ticketType === 'cr')
  @IsUUID()
  crId?: string;

  @ValidateIf((o: TimeLineInputDto) => o.ticketType === 'cr')
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  crNumber?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  /** Ignored (FIX 5) — server inherits from task.billable / project.billableByDefault. */
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
}

export class CreateTimeEntryDto {
  @IsDateString()
  entryDate!: string;

  @IsOptional()
  @IsIn(SOURCES)
  source?: (typeof SOURCES)[number];

  @IsOptional()
  @IsDateString()
  startTime?: string;

  /**
   * Omit / null for a running timer.
   * For manual entries, set endTime (or leave null only when source=timer).
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  endTime?: string | null;

  /** Mandatory first line — every entry must have at least one line. */
  @IsDefined()
  @ValidateNested()
  @Type(() => TimeLineInputDto)
  line!: TimeLineInputDto;
}
