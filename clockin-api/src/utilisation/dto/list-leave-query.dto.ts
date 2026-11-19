import { Matches } from 'class-validator';

export class ListLeaveQueryDto {
  /** YYYY-MM */
  @Matches(/^\d{4}-\d{2}$/)
  yearMonth!: string;
}
