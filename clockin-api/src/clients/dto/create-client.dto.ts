import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const CLIENT_STATUSES = ['active', 'inactive', 'archived'] as const;

export class CreateClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  /** ISO 4217 currency code, e.g. GBP */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO code (e.g. GBP)',
  })
  currency?: string;

  /** Account-manager membership id (must belong to the same org). */
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsIn(CLIENT_STATUSES)
  status?: (typeof CLIENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;
}
