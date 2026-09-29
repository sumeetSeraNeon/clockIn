import type { Prisma } from '@prisma/client';

/** Nested context so members can see project/PM/assignee without list APIs. */
export const TASK_DETAIL_INCLUDE = {
  project: {
    select: {
      id: true,
      name: true,
      code: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  },
  assignee: {
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.TaskInclude;

export type TaskWithDetail = Prisma.TaskGetPayload<{
  include: typeof TASK_DETAIL_INCLUDE;
}>;
