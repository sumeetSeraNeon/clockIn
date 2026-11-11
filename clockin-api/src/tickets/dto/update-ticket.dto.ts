import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CR_APPROVAL_STATUSES,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_CODES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from '../ticket.constants';

export class UpdateTicketDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Required on every ticket — cannot clear to null. */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsIn(TICKET_TYPES)
  ticketType?: (typeof TICKET_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  /** Any Freshdesk-aligned status may be set. */
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: (typeof TICKET_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number] | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(TICKET_PRIORITY_CODES)
  ticketPriority?: (typeof TICKET_PRIORITY_CODES)[number] | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  raisedBy?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  agentName?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  internalAgentName?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  contactName?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  contactExternalId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  source?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  tags?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  workstream?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(CR_APPROVAL_STATUSES)
  crApprovalStatus?: (typeof CR_APPROVAL_STATUSES)[number] | null;

  /** Change Request value — owner/admin only */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  crValue?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(10)
  crValueCurrency?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  closedAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  initialResponseAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  firstResponseSeconds?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  resolutionSeconds?: number | null;
}
