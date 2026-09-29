const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({
    orderBy: { email: "asc" },
    include: {
      memberships: {
        include: {
          membershipRoles: { include: { role: true } },
        },
      },
    },
  });
  const roles = await p.role.findMany({
    select: { name: true, _count: { select: { permissions: true } } },
    orderBy: { name: "asc" },
  });
  const memberMembership = await p.membership.findFirst({
    where: { user: { email: "sumeetbidhanwork2@gmail.com" } },
  });
  const tasks = await p.task.findMany({
    where: { assigneeId: memberMembership.id },
    select: { name: true, project: { select: { code: true } } },
  });
  const old = await p.user.count({
    where: { email: { in: ["owner@clockin.local", "employee@clockin.local"] } },
  });
  console.log(JSON.stringify({
    userCount: users.length,
    users: users.map((u) => ({
      email: u.email,
      status: u.status,
      firebaseLinked: Boolean(u.firebaseUid),
      roles: u.memberships.flatMap((m) =>
        m.membershipRoles.map((mr) => mr.role.name)
      ),
      membershipStatus: u.memberships[0]?.status,
    })),
    roles,
    memberAssignedTasks: tasks,
    oldDemoUsersGone: old === 0,
  }, null, 2));
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
