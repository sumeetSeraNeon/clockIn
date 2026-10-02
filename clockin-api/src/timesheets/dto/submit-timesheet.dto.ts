import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class SubmitTimesheetDto {
  /** Inclusive week start (YYYY-MM-DD), typically Monday — or a single day. */
  @IsDateString()
  periodStart!: string;

  /** Inclusive week end (YYYY-MM-DD), typically Sunday — or the same day. */
  @IsDateString()
  periodEnd!: string;

  /**
   * FIX 2 — optional: submit only entries for this task (per-task submission).
   * Omit to submit all draft/rejected entries in the range.
   */
  @IsOptional()
  @IsUUID()
  taskId?: string;
}
