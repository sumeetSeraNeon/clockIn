import type { Membership, User } from '@prisma/client';
import type { PermissionScope } from './permissions';

export type AuthRoleSummary = {
  id: string;
  name: string;
};

export type AuthPermissionSummary = {
  resource: string;
  action: string;
  /** own | managed | all — row visibility for FIX 1+ */
  scope: PermissionScope | null;
};

export type AuthMembership = Membership & {
  roles: AuthRoleSummary[];
  /** Union of permissions from all roles on this membership (widest scope wins). */
  permissions: AuthPermissionSummary[];
};

export type AuthenticatedRequest = {
  user: User;
  membership: AuthMembership;
  organisationId: string;
};

declare module 'express' {
  interface Request {
    user?: User;
    membership?: AuthMembership;
    organisationId?: string;
  }
}
