import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const TICKET_TYPES = ['incident', 'service_request'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export class CreateTicketDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  /** Human reference e.g. INC-1042 — unique per organisation */
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
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  raisedBy?: string;
}
