import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

const MEMBERSHIP_STATUSES = ['active', 'deactivated'] as const;

export class UpdateMemberDto {
  /** Replaces department links when sent (empty array clears them). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsIn(MEMBERSHIP_STATUSES)
  status?: (typeof MEMBERSHIP_STATUSES)[number];
}
