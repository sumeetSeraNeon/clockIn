import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const RATE_TYPES = ['cost', 'billable'] as const;
const SCOPES = [
  'organisation',
  'client',
  'project',
  'user',
  'task',
  'project_user',
] as const;

export class CreateRateDto {
  @IsIn(RATE_TYPES)
  rateType!: (typeof RATE_TYPES)[number];

  @IsIn(SCOPES)
  scope!: (typeof SCOPES)[number];

  @ValidateIf((o: CreateRateDto) =>
    ['client'].includes(o.scope),
  )
  @IsUUID()
  clientId?: string;

  @ValidateIf((o: CreateRateDto) =>
    ['project', 'project_user'].includes(o.scope),
  )
  @IsUUID()
  projectId?: string;

  @ValidateIf((o: CreateRateDto) =>
    ['user', 'project_user'].includes(o.scope),
  )
  @IsUUID()
  userId?: string;

  @ValidateIf((o: CreateRateDto) => o.scope === 'task')
  @IsUUID()
  taskId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO code (e.g. GBP)',
  })
  currency?: string;

  @IsDateString()
  effectiveFrom!: string;

  /** Optional end; omit/null = current open-ended rate */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  effectiveTo?: string | null;
}
