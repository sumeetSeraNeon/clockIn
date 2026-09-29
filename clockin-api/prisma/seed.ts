import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ROLE_PERMISSION_MATRIX,
  type SystemRoleName,
} from '../src/auth/permission-matrix';

/**
 * FIX 0 seed — three real users + five Clockify-style roles.
 * Permission rows come from FIX 1 matrix (src/auth/permission-matrix.ts).
 */

const prisma = new PrismaClient();

const ORG_ID = '00000000-0000-4000-8000-000000000001';

const USER = {
  owner: {
    id: '00000000-0000-4000-8000-000000000011',
    email: 'sumeet.bidhan@seraneon.co.uk',
    name: 'Sumeet Bidhan',
  },
  admin: {
    id: '00000000-0000-4000-8000-000000000012',
    email: 'sumeetbidhanwork@gmail.com',
    name: 'Sumeet Admin',
  },
  member: {
    id: '00000000-0000-4000-8000-000000000013',
    email: 'sumeetbidhanwork2@gmail.com',
    name: 'Sumeet Member',
  },
} as const;

const MEMBERSHIP = {
  owner: '00000000-0000-4000-8000-000000000021',
  admin: '00000000-0000-4000-8000-000000000022',
  member: '00000000-0000-4000-8000-000000000023',
} as const;

const ROLE: Record<SystemRoleName, string> = {
  owner: '00000000-0000-4000-8000-000000000031',
  admin: '00000000-0000-4000-8000-000000000032',
  project_manager: '00000000-0000-4000-8000-000000000033',
  team_manager: '00000000-0000-4000-8000-000000000034',
  member: '00000000-0000-4000-8000-000000000035',
};

async function resolveFirebaseUid(
  email: string,
): Promise<{ uid: string | null; created: boolean }> {
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
        return { uid: null, created: false };
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

    const auth = getAuth();
    try {
      const existing = await auth.getUserByEmail(email);
      return { uid: existing.uid, created: false };
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : '';
      if (code !== 'auth/user-not-found') throw err;
      // FIX 0: do not create Firebase users — they already exist in the console.
      console.warn(
        `Firebase user not found for ${email} — create them in Firebase Console, then re-seed to link UID`,
      );
      return { uid: null, created: false };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Firebase link skipped for ${email}: ${message}`);
    return { uid: null, created: false };
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

  const firebaseByEmail: Record<string, string | null> = {};
  for (const u of Object.values(USER)) {
    const { uid } = await resolveFirebaseUid(u.email);
    firebaseByEmail[u.email] = uid;
  }

  const ownerUser = await prisma.user.upsert({
    where: { email: USER.owner.email },
    update: {
      name: USER.owner.name,
      status: 'active',
      authProvider: firebaseByEmail[USER.owner.email] ? 'firebase' : 'local',
      firebaseUid: firebaseByEmail[USER.owner.email],
    },
    create: {
      id: USER.owner.id,
      email: USER.owner.email,
      name: USER.owner.name,
      status: 'active',
      authProvider: firebaseByEmail[USER.owner.email] ? 'firebase' : 'local',
      firebaseUid: firebaseByEmail[USER.owner.email],
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: USER.admin.email },
    update: {
      name: USER.admin.name,
      status: 'active',
      authProvider: firebaseByEmail[USER.admin.email] ? 'firebase' : 'local',
      firebaseUid: firebaseByEmail[USER.admin.email],
    },
    create: {
      id: USER.admin.id,
      email: USER.admin.email,
      name: USER.admin.name,
      status: 'active',
      authProvider: firebaseByEmail[USER.admin.email] ? 'firebase' : 'local',
      firebaseUid: firebaseByEmail[USER.admin.email],
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { email: USER.member.email },
    update: {
      name: USER.member.name,
      status: 'active',
      authProvider: firebaseByEmail[USER.member.email] ? 'firebase' : 'local',
      firebaseUid: firebaseByEmail[USER.member.email],
    },
    create: {
      id: USER.member.id,
      email: USER.member.email,
      name: USER.member.name,
      status: 'active',
      authProvider: firebaseByEmail[USER.member.email] ? 'firebase' : 'local',
      firebaseUid: firebaseByEmail[USER.member.email],
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
      id: MEMBERSHIP.owner,
      organisationId: org.id,
      userId: ownerUser.id,
      memberType: 'staff',
      department: 'Leadership',
      status: 'active',
    },
  });

  const adminMembership = await prisma.membership.upsert({
    where: {
      organisationId_userId: {
        organisationId: org.id,
        userId: adminUser.id,
      },
    },
    update: {
      status: 'active',
      department: 'Leadership',
      managerId: ownerMembership.id,
      memberType: 'staff',
    },
    create: {
      id: MEMBERSHIP.admin,
      organisationId: org.id,
      userId: adminUser.id,
      memberType: 'staff',
      department: 'Leadership',
      managerId: ownerMembership.id,
      status: 'active',
    },
  });

  const memberMembership = await prisma.membership.upsert({
    where: {
      organisationId_userId: {
        organisationId: org.id,
        userId: memberUser.id,
      },
    },
    update: {
      status: 'active',
      department: 'Delivery',
      managerId: adminMembership.id,
      memberType: 'staff',
    },
    create: {
      id: MEMBERSHIP.member,
      organisationId: org.id,
      userId: memberUser.id,
      memberType: 'staff',
      department: 'Delivery',
      managerId: adminMembership.id,
      status: 'active',
    },
  });

  const roleRows: { key: SystemRoleName; name: SystemRoleName }[] = [
    { key: 'owner', name: 'owner' },
    { key: 'admin', name: 'admin' },
    { key: 'project_manager', name: 'project_manager' },
    { key: 'team_manager', name: 'team_manager' },
    { key: 'member', name: 'member' },
  ];

  for (const { key, name } of roleRows) {
    await prisma.role.upsert({
      where: { id: ROLE[key] },
      update: { name, isSystem: true, organisationId: org.id },
      create: {
        id: ROLE[key],
        organisationId: org.id,
        name,
        isSystem: true,
      },
    });
  }

  // Clear old permissions on these roles, then reseed matrix
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

  await prisma.membershipRole.deleteMany({
    where: {
      membershipId: {
        in: [ownerMembership.id, adminMembership.id, memberMembership.id],
      },
    },
  });

  await prisma.membershipRole.createMany({
    data: [
      { membershipId: ownerMembership.id, roleId: ROLE.owner },
      { membershipId: adminMembership.id, roleId: ROLE.admin },
      { membershipId: memberMembership.id, roleId: ROLE.member },
    ],
  });

  // Sample work — member is assigned tasks on a project owned by admin (future PM tests)
  const client = await prisma.client.upsert({
    where: { id: '00000000-0000-4000-8000-000000000051' },
    update: {
      name: 'Acme Corp',
      code: 'ACME',
      ownerId: ownerMembership.id,
      status: 'active',
    },
    create: {
      id: '00000000-0000-4000-8000-000000000051',
      organisationId: org.id,
      name: 'Acme Corp',
      code: 'ACME',
      currency: 'GBP',
      ownerId: ownerMembership.id,
      status: 'active',
    },
  });

  const otherClient = await prisma.client.upsert({
    where: { id: '00000000-0000-4000-8000-000000000052' },
    update: {
      name: 'Globex',
      code: 'GLX',
      ownerId: ownerMembership.id,
      status: 'active',
    },
    create: {
      id: '00000000-0000-4000-8000-000000000052',
      organisationId: org.id,
      name: 'Globex',
      code: 'GLX',
      currency: 'GBP',
      ownerId: ownerMembership.id,
      status: 'active',
    },
  });

  const memberProject = await prisma.project.upsert({
    where: { id: '00000000-0000-4000-8000-000000000061' },
    update: {
      name: 'Acme Implementation',
      code: 'ACME-IMP',
      ownerId: adminMembership.id,
      status: 'active',
      billableByDefault: true,
      clientId: client.id,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000061',
      organisationId: org.id,
      clientId: client.id,
      name: 'Acme Implementation',
      code: 'ACME-IMP',
      ownerId: adminMembership.id,
      status: 'active',
      billableByDefault: true,
    },
  });

  // Second project the member is NOT assigned to (for FIX 3 scoping tests)
  await prisma.project.upsert({
    where: { id: '00000000-0000-4000-8000-000000000062' },
    update: {
      name: 'Globex Retainer',
      code: 'GLX-RET',
      ownerId: ownerMembership.id,
      status: 'active',
      clientId: otherClient.id,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000062',
      organisationId: org.id,
      clientId: otherClient.id,
      name: 'Globex Retainer',
      code: 'GLX-RET',
      ownerId: ownerMembership.id,
      status: 'active',
      billableByDefault: true,
    },
  });

  await prisma.task.deleteMany({
    where: {
      id: {
        in: [
          '00000000-0000-4000-8000-000000000071',
          '00000000-0000-4000-8000-000000000072',
          '00000000-0000-4000-8000-000000000073',
          '00000000-0000-4000-8000-000000000074',
        ],
      },
    },
  });

  await prisma.task.createMany({
    data: [
      {
        id: '00000000-0000-4000-8000-000000000071',
        organisationId: org.id,
        projectId: memberProject.id,
        name: 'Discovery',
        status: 'open',
        assigneeId: memberMembership.id,
        billable: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000072',
        organisationId: org.id,
        projectId: memberProject.id,
        name: 'Build',
        status: 'open',
        assigneeId: memberMembership.id,
        billable: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000073',
        organisationId: org.id,
        projectId: memberProject.id,
        name: 'UAT Support',
        status: 'open',
        assigneeId: memberMembership.id,
        // R2-FIX 1 — non-billable task for inheritance verify
        billable: false,
      },
      {
        id: '00000000-0000-4000-8000-000000000074',
        organisationId: org.id,
        projectId: '00000000-0000-4000-8000-000000000062',
        name: 'Unassigned Globex work',
        status: 'open',
        assigneeId: null,
        billable: true,
      },
    ],
  });

  const ticket = await prisma.ticket.upsert({
    where: { id: '00000000-0000-4000-8000-000000000081' },
    update: {
      clientId: client.id,
      projectId: memberProject.id,
      reference: 'INC-1001',
      title: 'Login timeout on staging',
      status: 'open',
    },
    create: {
      id: '00000000-0000-4000-8000-000000000081',
      organisationId: org.id,
      clientId: client.id,
      projectId: memberProject.id,
      reference: 'INC-1001',
      ticketType: 'incident',
      title: 'Login timeout on staging',
      description: 'Users intermittently hit session timeouts after SSO.',
      status: 'open',
      priority: 'high',
      openedAt: new Date('2026-09-01T09:00:00.000Z'),
    },
  });

  const rateEffectiveFrom = new Date('2026-01-01');
  await prisma.rate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000091' },
    update: { currency: 'GBP' },
    create: {
      id: '00000000-0000-4000-8000-000000000091',
      organisationId: org.id,
      rateType: 'billable',
      scope: 'organisation',
      amount: 125,
      currency: 'GBP',
      effectiveFrom: rateEffectiveFrom,
    },
  });

  await prisma.rate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000092' },
    update: { currency: 'GBP' },
    create: {
      id: '00000000-0000-4000-8000-000000000092',
      organisationId: org.id,
      rateType: 'cost',
      scope: 'organisation',
      amount: 75,
      currency: 'GBP',
      effectiveFrom: rateEffectiveFrom,
    },
  });

  // Closed historical org billable (so History tab has content)
  await prisma.rate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000093' },
    update: { currency: 'GBP' },
    create: {
      id: '00000000-0000-4000-8000-000000000093',
      organisationId: org.id,
      rateType: 'billable',
      scope: 'organisation',
      amount: 110,
      currency: 'GBP',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  // Client billable override
  await prisma.rate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000094' },
    update: { currency: 'GBP' },
    create: {
      id: '00000000-0000-4000-8000-000000000094',
      organisationId: org.id,
      rateType: 'billable',
      scope: 'client',
      clientId: client.id,
      amount: 140,
      currency: 'GBP',
      effectiveFrom: rateEffectiveFrom,
    },
  });

  // Project billable override
  await prisma.rate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000095' },
    update: { currency: 'GBP' },
    create: {
      id: '00000000-0000-4000-8000-000000000095',
      organisationId: org.id,
      rateType: 'billable',
      scope: 'project',
      projectId: memberProject.id,
      amount: 150,
      currency: 'GBP',
      effectiveFrom: rateEffectiveFrom,
    },
  });

  // Person cost rate
  await prisma.rate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000096' },
    update: { currency: 'GBP' },
    create: {
      id: '00000000-0000-4000-8000-000000000096',
      organisationId: org.id,
      rateType: 'cost',
      scope: 'user',
      userId: memberUser.id,
      amount: 55,
      currency: 'GBP',
      effectiveFrom: rateEffectiveFrom,
    },
  });

  const entryDate = new Date('2026-09-15');
  const timeEntry = await prisma.timeEntry.upsert({
    where: { id: '00000000-0000-4000-8000-0000000000a1' },
    update: { userId: memberUser.id },
    create: {
      id: '00000000-0000-4000-8000-0000000000a1',
      organisationId: org.id,
      userId: memberUser.id,
      entryDate,
      startTime: new Date('2026-09-15T09:00:00.000Z'),
      endTime: new Date('2026-09-15T11:00:00.000Z'),
      status: 'draft',
      source: 'manual',
    },
  });

  await prisma.timeLine.upsert({
    where: { id: '00000000-0000-4000-8000-0000000000b1' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-0000000000b1',
      organisationId: org.id,
      timeEntryId: timeEntry.id,
      taskId: '00000000-0000-4000-8000-000000000071',
      projectId: memberProject.id,
      clientId: client.id,
      ticketId: ticket.id,
      ticketType: 'incident',
      area: 'technical',
      durationMinutes: 120,
      billable: true,
      description: 'Investigate SSO session timeout',
      isFirstLine: true,
    },
  });

  const userCount = await prisma.user.count();
  const roles = await prisma.role.findMany({
    where: { organisationId: org.id },
    select: { name: true, _count: { select: { permissions: true } } },
    orderBy: { name: 'asc' },
  });
  const assignments = await prisma.task.count({
    where: { assigneeId: memberMembership.id },
  });

  console.log('FIX 0 seed complete:', {
    organisation: org.name,
    users: [ownerUser.email, adminUser.email, memberUser.email],
    userCount,
    roles: roles.map((r) => `${r.name}(${r._count.permissions} perms)`),
    memberAssignedTasks: assignments,
    memberProject: memberProject.code,
    ticket: ticket.reference,
  });

  if (userCount !== 3) {
    throw new Error(
      `Expected exactly 3 users after seed, found ${userCount}. migrate reset required.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
