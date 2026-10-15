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

export class TaskImportRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  rowKey!: string;

  @IsString()
  @MaxLength(200)
  taskName!: string;

  @IsString()
  @MaxLength(200)
  projectName!: string;

  @IsString()
  @MaxLength(200)
  clientName!: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  clientId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsBoolean()
  createClient?: boolean;

  @IsOptional()
  @IsBoolean()
  createProject?: boolean;

  @IsOptional()
  @IsBoolean()
  excluded?: boolean;
}

export class TaskImportPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => TaskImportRowDto)
  rows!: TaskImportRowDto[];
}

export class TaskImportCommitDto extends TaskImportPreviewDto {}
