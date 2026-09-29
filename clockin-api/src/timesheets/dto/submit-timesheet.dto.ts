import { IsDateString } from 'class-validator';

export class SubmitTimesheetDto {
  /** Inclusive week start (YYYY-MM-DD), typically Monday. */
  @IsDateString()
  periodStart!: string;

  /** Inclusive week end (YYYY-MM-DD), typically Sunday. */
  @IsDateString()
  periodEnd!: string;
}
