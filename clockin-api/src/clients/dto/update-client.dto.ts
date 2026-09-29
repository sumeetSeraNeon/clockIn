import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const CLIENT_STATUSES = ['active', 'inactive', 'archived'] as const;

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO code (e.g. GBP)',
  })
  currency?: string;

  /** Pass null to clear the owner; omit to leave unchanged. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @IsIn(CLIENT_STATUSES)
  status?: (typeof CLIENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;
}
