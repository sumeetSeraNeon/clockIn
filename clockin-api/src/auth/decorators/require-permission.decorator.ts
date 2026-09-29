import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

export type RequiredPermission = {
  resource: string;
  action: string;
};

/**
 * Marks a handler as requiring a membership permission
 * (role → permissions), e.g. `@RequirePermission('report', 'view')`.
 */
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { resource, action } satisfies RequiredPermission);
