import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const MEMBER_TYPES = ['staff', 'contractor', 'client_contact'] as const;

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(MEMBER_TYPES)
  memberType?: (typeof MEMBER_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  /** Manager membership id in the same org */
  @IsOptional()
  @IsUUID()
  managerId?: string;

  /** Optional roles to assign on invite (must belong to this org) */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
