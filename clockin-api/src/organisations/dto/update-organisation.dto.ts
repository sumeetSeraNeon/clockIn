import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateOrganisationDto {
  /** ISO 4217 — organisation default currency (FIX 3). */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO code (e.g. GBP)',
  })
  currency?: string;
}
