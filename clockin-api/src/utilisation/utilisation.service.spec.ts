import { ForbiddenException } from '@nestjs/common';
import { UtilisationService } from './utilisation.service';

describe('UtilisationService leave write rules', () => {
  const prisma = {
    membership: { findFirst: jest.fn() },
    leaveEntry: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
  const visibility = {};
  const service = new UtilisationService(prisma as never, visibility as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function membership(roles: string[], id = 'mgr-1') {
    return {
      id,
      roles: roles.map((name) => ({ name })),
      permissions: [],
    };
  }

  it('rejects project_manager leave writes with 403', async () => {
    await expect(
      service.upsertLeave(
        'org-1',
        membership(['project_manager']) as never,
        'user-2',
        '2026-11',
        { leaveDays: 1 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects member leave writes with 403', async () => {
    await expect(
      service.upsertLeave(
        'org-1',
        membership(['member']) as never,
        'user-2',
        '2026-11',
        { leaveDays: 1 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects team_manager editing someone who is not a direct report', async () => {
    prisma.membership.findFirst.mockResolvedValue({
      id: 'mem-2',
      managerId: 'other-mgr',
    });
    await expect(
      service.upsertLeave(
        'org-1',
        membership(['team_manager'], 'mgr-1') as never,
        'user-2',
        '2026-11',
        { leaveDays: 1 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
