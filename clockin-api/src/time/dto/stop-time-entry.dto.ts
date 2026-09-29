import { IsDateString, IsOptional } from 'class-validator';

export class StopTimeEntryDto {
  /** Defaults to now (UTC) if omitted */
  @IsOptional()
  @IsDateString()
  endTime?: string;
}
