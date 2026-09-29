import {
  IsDateString,
  IsOptional,
  ValidateIf,
} from 'class-validator';

/** FIX 8 — drag/resize calendar updates start/end (and optionally entryDate). */
export class UpdateTimeEntryDto {
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  endTime?: string | null;
}
