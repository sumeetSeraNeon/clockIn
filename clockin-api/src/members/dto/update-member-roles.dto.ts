import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator';

/**
 * Assign and/or remove roles on a membership.
 * At least one of addRoleIds / removeRoleIds must be provided.
 */
export class UpdateMemberRolesDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  addRoleIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  removeRoleIds?: string[];
}
