import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertLeaveDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  leaveDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
