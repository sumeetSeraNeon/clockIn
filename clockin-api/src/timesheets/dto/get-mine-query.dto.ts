import { IsDateString } from 'class-validator';

export class GetMineTimesheetQueryDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
