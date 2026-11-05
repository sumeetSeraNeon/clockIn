import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination';

const RATE_TYPES = ['cost', 'billable'] as const;
const SCOPES = [
  'organisation',
  'client',
  'project',
  'user',
  'task',
  'project_user',
] as const;

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export class ListRatesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsIn(RATE_TYPES)
  rateType?: (typeof RATE_TYPES)[number];

  @IsOptional()
  @IsIn(SCOPES)
  scope?: (typeof SCOPES)[number];

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  /**
   * When true, only rates effective today; when false, ended or not started yet.
   * Ignored when month is set. Read the raw query string — implicit conversion
   * turns the string "false" into true before this transform runs.
   */
  @IsOptional()
  @Transform(({ obj }) =>
    toOptionalBoolean((obj as { current?: unknown } | undefined)?.current),
  )
  @IsBoolean()
  current?: boolean;

  /** YYYY-MM. Rates whose range overlaps this calendar month. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be YYYY-MM',
  })
  month?: string;

  /** Matches project, person, email, client, or task name. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
