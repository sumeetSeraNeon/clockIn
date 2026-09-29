import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestAccessDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  /** Organisation code from seed / admin (e.g. CLK). */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  organisationCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}
