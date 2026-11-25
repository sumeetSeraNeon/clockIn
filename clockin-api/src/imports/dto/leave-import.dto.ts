import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IMPORT_MAX_ROWS } from '../import.types';

export class LeaveImportRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  rowKey!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(320)
  email!: string;

  /** String so Excel decimals are not mangled; parsed in the service. */
  @IsString()
  @MaxLength(32)
  leaveDays!: string;

  @IsOptional()
  @IsBoolean()
  excluded?: boolean;
}

export class LeaveImportPreviewDto {
  /** YYYY-MM from the Leave tab selection. */
  @Matches(/^\d{4}-\d{2}$/)
  yearMonth!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => LeaveImportRowDto)
  rows!: LeaveImportRowDto[];
}

export class LeaveImportCommitDto extends LeaveImportPreviewDto {}
