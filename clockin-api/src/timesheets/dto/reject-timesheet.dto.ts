import { IsString, MinLength } from 'class-validator';

export class RejectTimesheetDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
