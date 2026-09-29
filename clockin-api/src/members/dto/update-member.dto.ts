import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const MEMBERSHIP_STATUSES = ['active', 'deactivated'] as const;

export class UpdateMemberDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  department?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsIn(MEMBERSHIP_STATUSES)
  status?: (typeof MEMBERSHIP_STATUSES)[number];
}
