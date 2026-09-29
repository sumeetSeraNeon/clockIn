/**
 * Part 0 wipe — delete ALL app data, then keep only:
 * organisation (Sera Neon / CLK) + 5 system roles/permissions +
 * sumeet.bidhan@seraneon.co.uk as owner.
 *
 * Run once: npx ts-node --compiler-options {"module":"CommonJS"} prisma/wipe-keep-owner.ts
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ROLE_PERMISSION_MATRIX,
  type SystemRoleName,
} from '../src/auth/permission-matrix';

const prisma = new PrismaClient();

const KEEP_EMAIL = 'sumeet.bidhan@seraneon.co.uk';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000011';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000021';

const ROLE: Record<SystemRoleName, string> = {
  owner: '00000000-0000-4000-8000-000000000031',
  admin: '00000000-0000-4000-8000-000000000032',
  project_manager: '00000000-0000-4000-8000-000000000033',
  team_manager: '00000000-0000-4000-8000-000000000034',
  member: '00000000-0000-4000-8000-000000000035',
};

/** All Prisma-mapped tables — truncate wipes demo + leftover rows. */
const ALL_TABLES = [
  'ai_interactions',
  'workflow_rules',
  'portal_access',
  'supplier_invoices',
  'contractor_profiles',
  'webhooks',
  'api_keys',
  'branding',
  'configurable_work_types',
  'custom_field_values',
  'custom_field_defs',
  'entitlements',
  'subscriptions',
  'risk_flags',
  'notifications',
  'alert_rules',
  'forecasts',
  'time_off_requests',
  'time_off_policies',
  'expenses',
  'approvals',
  'timesheet_period_slices',
  'timesheet_periods',
  'invoice_allocations',
  'invoices',
  'overrun_attempts',
  'cr_consumption',
  'change_requests',
  'audit_events',
  'holidays',
  'working_calendar',
  'rates',
  'time_line_tags',
  'tags',
  'time_lines',
  'time_entries',
  'tickets',
  'tasks',
  'projects',
  'clients',
  'permissions',
  'membership_roles',
  'memberships',
  'roles',
  'users',
  'organisations',
];

async function resolveFirebaseUid(email: string): Promise<string | null> {
  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');

    if (getApps().length === 0) {
      const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const fallback = resolve(
        process.cwd(),
        'secrets',
        'firebase-service-account.json',
      );
      const path = envPath && existsSync(envPath) ? envPath : fallback;
      if (!existsSync(path)) {
        console.warn(`Firebase credentials not found — skip UID link for ${email}`);
        return null;
      }
      const sa = JSON.parse(readFileSync(path, 'utf8')) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
      initializeApp({
        credential: cert({
          projectId: sa.project_id,
          clientEmail: sa.client_email,
          privateKey: sa.private_key,
        }),
        projectId: sa.project_id,
      });
    }

    const existing = await getAuth().getUserByEmail(email);
    return existing.uid;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Firebase link skipped for ${email}: ${message}`);
    return null;
  }
}

async function main() {
  console.log('Wiping ALL tables…');
  const listed = ALL_TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${listed} CASCADE`);

  console.log('Creating org + roles + owner only…');

  const org = await prisma.organisation.create({
    data: {
      id: ORG_ID,
      name: 'Sera Neon',
      code: 'CLK',
      currency: 'GBP',
      timezone: 'UTC',
      status: 'active',
    },
  });

  for (const name of Object.keys(ROLE) as SystemRoleName[]) {
    await prisma.role.create({
      data: {
        id: ROLE[name],
        organisationId: org.id,
        name,
        isSystem: true,
      },
    });
  }

  for (const [roleKey, perms] of Object.entries(ROLE_PERMISSION_MATRIX) as [
    SystemRoleName,
    (typeof ROLE_PERMISSION_MATRIX)[SystemRoleName],
  ][]) {
    for (const p of perms) {
      await prisma.permission.create({
        data: {
          id: p.id,
          roleId: ROLE[roleKey],
          resource: p.resource,
          action: p.action,
          scope: p.scope,
        },
      });
    }
  }

  const firebaseUid = await resolveFirebaseUid(KEEP_EMAIL);

  const ownerUser = await prisma.user.create({
    data: {
      id: USER_ID,
      email: KEEP_EMAIL,
      name: 'Sumeet Bidhan',
      status: 'active',
      authProvider: firebaseUid ? 'firebase' : 'local',
      firebaseUid,
    },
  });

  const ownerMembership = await prisma.membership.create({
    data: {
      id: MEMBERSHIP_ID,
      organisationId: org.id,
      userId: ownerUser.id,
      memberType: 'staff',
      department: 'Leadership',
      status: 'active',
    },
  });

  await prisma.membershipRole.create({
    data: {
      membershipId: ownerMembership.id,
      roleId: ROLE.owner,
    },
  });

  const counts = {
    users: await prisma.user.count(),
    memberships: await prisma.membership.count(),
    clients: await prisma.client.count(),
    projects: await prisma.project.count(),
    tasks: await prisma.task.count(),
    rates: await prisma.rate.count(),
    timeEntries: await prisma.timeEntry.count(),
    roles: await prisma.role.count(),
  };

  console.log('Wipe complete.', {
    organisation: org.name,
    code: org.code,
    owner: ownerUser.email,
    firebaseUid: ownerUser.firebaseUid,
    counts,
  });

  if (counts.users !== 1 || counts.clients !== 0 || counts.projects !== 0) {
    throw new Error('Wipe verification failed — unexpected leftover data');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
