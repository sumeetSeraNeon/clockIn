import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IMPORT_MAX_ROWS } from '../import.types';

export class TicketImportRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  rowKey!: string;

  @IsString()
  @MaxLength(200)
  clientName!: string;

  @IsString()
  @MaxLength(50)
  reference!: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsString()
  @MaxLength(100)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority?: string | null;

  @IsString()
  @MaxLength(100)
  ticketType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  agentName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  groupName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  openedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dueAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  resolvedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  closedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  initialResponseAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  firstResponseDuration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  resolutionDuration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  internalAgentName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ticketPriority?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  workstream?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactExternalId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  clientId?: string | null;

  @IsOptional()
  @IsBoolean()
  excluded?: boolean;
}

export class TicketImportPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => TicketImportRowDto)
  rows!: TicketImportRowDto[];
}

export class TicketImportCommitDto extends TicketImportPreviewDto {}
