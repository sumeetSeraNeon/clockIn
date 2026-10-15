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

export class ProjectImportRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  rowKey!: string;

  @IsString()
  @MaxLength(200)
  clientName!: string;

  @IsString()
  @MaxLength(200)
  projectName!: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  clientId?: string | null;

  @IsOptional()
  @IsBoolean()
  createClient?: boolean;

  @IsOptional()
  @IsBoolean()
  excluded?: boolean;
}

export class ProjectImportPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ProjectImportRowDto)
  rows!: ProjectImportRowDto[];
}

export class ProjectImportCommitDto extends ProjectImportPreviewDto {}
