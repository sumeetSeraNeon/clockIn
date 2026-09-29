import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export class UpdateTicketDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  /**
   * Forward transitions only:
   * open → in_progress → resolved → closed
   */
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: (typeof TICKET_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number] | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  raisedBy?: string | null;
}
