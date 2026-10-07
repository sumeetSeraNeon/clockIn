import { IsOptional, IsString, MaxLength } from 'class-validator';

/** GET /timesheets/pending — optional requester/client/project search. */
export class ListPendingQueryDto {
  /** Case-insensitive match on requester name/email, client name, or project name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
