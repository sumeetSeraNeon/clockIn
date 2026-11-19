import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpsertUtilisationMonthDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  plannedHours!: number;
}
