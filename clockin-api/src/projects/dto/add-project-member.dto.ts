import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class AddProjectMemberDto {
  @IsUUID()
  membershipId!: string;

  /** contributor | lead — defaults to contributor */
  @IsOptional()
  @IsIn(['contributor', 'lead'])
  roleOnProject?: 'contributor' | 'lead';
}
