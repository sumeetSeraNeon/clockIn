import type { Prisma } from '@prisma/client';

/** Nested owner so members can see project manager without /members. */
export const PROJECT_DETAIL_INCLUDE = {
  owner: {
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectWithDetail = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_DETAIL_INCLUDE;
}>;
