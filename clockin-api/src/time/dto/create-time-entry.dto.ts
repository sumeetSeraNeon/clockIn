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
  ValidateNested,
} from 'class-validator';

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

  /**
   * Ignored when ticketId is set — server derives type from the ticket.
   * Kept optional for backwards-compatible clients; do not send for new UI.
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ticketType?: string;

  @IsOptional()
  @IsIn(AREAS)
  area?: string;

  /** Deprecated — ignored. Use ticketId (Change Request = ticket). */
  @IsOptional()
  @IsUUID()
  crId?: string;

  /** Deprecated — ignored. Ticket reference comes from the linked ticket. */
  @IsOptional()
  @IsString()
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

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => TimeLineInputDto)
  line!: TimeLineInputDto;
}
