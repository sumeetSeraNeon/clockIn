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
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CR_APPROVAL_STATUSES,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_CODES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from '../ticket.constants';

export class CreateTicketDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** Human reference e.g. INC-1042 or Freshdesk Ticket ID — unique per organisation */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  reference!: string;

  @IsIn(TICKET_TYPES)
  ticketType!: (typeof TICKET_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: (typeof TICKET_STATUSES)[number];

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number];

  @IsOptional()
  @IsIn(TICKET_PRIORITY_CODES)
  ticketPriority?: (typeof TICKET_PRIORITY_CODES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  raisedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  agentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  internalAgentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactExternalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  workstream?: string;

  /** Change Request only — defaults to pending */
  @IsOptional()
  @IsIn(CR_APPROVAL_STATUSES)
  crApprovalStatus?: (typeof CR_APPROVAL_STATUSES)[number];

  /** Change Request value — owner/admin only */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  crValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  crValueCurrency?: string;

  @IsOptional()
  @IsDateString()
  openedAt?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsDateString()
  resolvedAt?: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @IsOptional()
  @IsDateString()
  initialResponseAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  firstResponseSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  resolutionSeconds?: number;
}
