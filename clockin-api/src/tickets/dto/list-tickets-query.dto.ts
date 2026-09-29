import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination';

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const TICKET_TYPES = ['incident', 'service_request'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export class ListTicketsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: (typeof TICKET_STATUSES)[number];

  @IsOptional()
  @IsIn(TICKET_TYPES)
  ticketType?: (typeof TICKET_TYPES)[number];

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number];
}
