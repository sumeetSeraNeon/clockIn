import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IMPORT_MAX_ROWS } from '../import.types';

export class ClientImportRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  rowKey!: string;

  @IsString()
  @MaxLength(200)
  clientName!: string;

  @IsOptional()
  @IsBoolean()
  excluded?: boolean;
}

export class ClientImportPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ClientImportRowDto)
  rows!: ClientImportRowDto[];
}

export class ClientImportCommitDto extends ClientImportPreviewDto {}
