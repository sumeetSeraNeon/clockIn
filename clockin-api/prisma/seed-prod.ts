/**
 * Production bootstrap — idempotent.
 * Creates org CLK + system roles/permissions + owner only.
 * Does NOT create demo clients/projects/time. Safe to re-run on Render start.
 *
 * npm run seed:prod
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ROLE_PERMISSION_MATRIX,
  type SystemRoleName,
} from '../src/auth/permission-matrix';

const prisma = new PrismaClient();

const OWNER_EMAIL = 'sumeet.bidhan@seraneon.co.uk';

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

async function resolveFirebaseUid(email: string): Promise<string | null> {
  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');

    if (getApps().length === 0) {
      const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (jsonEnv?.trim()) {
        const sa = JSON.parse(jsonEnv) as {
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
      } else {
        const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const fallback = resolve(
          process.cwd(),
          'secrets',
          'firebase-service-account.json',
        );
        const path = envPath && existsSync(envPath) ? envPath : fallback;
        if (!existsSync(path)) {
          console.warn(
            `Firebase credentials not found — skip UID link for ${email}`,
          );
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
  const org = await prisma.organisation.upsert({
    where: { id: ORG_ID },
    update: {
      name: 'Sera Neon',
      code: 'CLK',
      currency: 'GBP',
      timezone: 'UTC',
      status: 'active',
    },
    create: {
      id: ORG_ID,
      name: 'Sera Neon',
      code: 'CLK',
      currency: 'GBP',
      timezone: 'UTC',
      status: 'active',
    },
  });

  for (const name of Object.keys(ROLE) as SystemRoleName[]) {
    await prisma.role.upsert({
      where: { id: ROLE[name] },
      update: { name, isSystem: true, organisationId: org.id },
      create: {
        id: ROLE[name],
        organisationId: org.id,
        name,
        isSystem: true,
      },
    });
  }

  await prisma.permission.deleteMany({
    where: { roleId: { in: Object.values(ROLE) } },
  });

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

  const firebaseUid = await resolveFirebaseUid(OWNER_EMAIL);

  const ownerUser = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {
      name: 'Sumeet Bidhan',
      status: 'active',
      authProvider: firebaseUid ? 'firebase' : 'local',
      ...(firebaseUid ? { firebaseUid } : {}),
    },
    create: {
      id: USER_ID,
      email: OWNER_EMAIL,
      name: 'Sumeet Bidhan',
      status: 'active',
      authProvider: firebaseUid ? 'firebase' : 'local',
      firebaseUid,
    },
  });

  const ownerMembership = await prisma.membership.upsert({
    where: {
      organisationId_userId: {
        organisationId: org.id,
        userId: ownerUser.id,
      },
    },
    update: {
      status: 'active',
      department: 'Leadership',
      managerId: null,
      memberType: 'staff',
    },
    create: {
      id: MEMBERSHIP_ID,
      organisationId: org.id,
      userId: ownerUser.id,
      memberType: 'staff',
      department: 'Leadership',
      status: 'active',
    },
  });

  await prisma.membershipRole.deleteMany({
    where: { membershipId: ownerMembership.id },
  });
  await prisma.membershipRole.create({
    data: {
      membershipId: ownerMembership.id,
      roleId: ROLE.owner,
    },
  });

  console.log('seed:prod complete', {
    organisation: org.name,
    code: org.code,
    owner: ownerUser.email,
    firebaseUid: ownerUser.firebaseUid,
    users: await prisma.user.count(),
    clients: await prisma.client.count(),
    projects: await prisma.project.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
