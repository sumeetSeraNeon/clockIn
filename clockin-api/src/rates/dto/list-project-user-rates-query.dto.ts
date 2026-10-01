import { IsOptional, IsUUID } from 'class-validator';

/** STEP 2 — current cost + bill + margin for project_user rates on a project. */
export class ListProjectUserRatesQueryDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
