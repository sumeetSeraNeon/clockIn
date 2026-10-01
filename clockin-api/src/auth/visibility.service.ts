import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthMembership } from './auth.types';
import { scopeFor, type PermissionScope } from './permissions';
import { PrismaService } from '../prisma/prisma.service';

/**
 * FIX 3 — second scoping layer after organisationId (read filters).
 * FIX 4 — assertCan* helpers for write/action enforcement.
 */
@Injectable()
export class VisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Projects the membership is assigned to via task.assignee_id. */
  async assignedProjectIds(
    organisationId: string,
    membershipId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.task.findMany({
      where: { organisationId, assigneeId: membershipId },
      select: { projectId: true },
      distinct: ['projectId'],
    });
    return rows.map((r) => r.projectId);
  }

  /**
   * STEP 1 — projects where this membership is an active project_members row
   * (independent of task assignment).
   */
  async memberProjectIds(
    organisationId: string,
    membershipId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: {
        organisationId,
        membershipId,
        status: 'active',
      },
      select: { projectId: true },
    });
    return rows.map((r) => r.projectId);
  }

  /** True when membership is an active member of the project. */
  async isProjectMember(
    organisationId: string,
    projectId: string,
    membershipId: string,
  ): Promise<boolean> {
    const row = await this.prisma.projectMember.findFirst({
      where: {
        organisationId,
        projectId,
        membershipId,
        status: 'active',
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  /** Projects where this membership is projects.owner_id (PM). */
  async managedProjectIds(
    organisationId: string,
    membershipId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.project.findMany({
      where: { organisationId, ownerId: membershipId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Memberships that report to this manager (plus self). */
  async managedMembershipIds(
    organisationId: string,
    membershipId: string,
  ): Promise<string[]> {
    const reports = await this.prisma.membership.findMany({
      where: { organisationId, managerId: membershipId },
      select: { id: true },
    });
    return [membershipId, ...reports.map((r) => r.id)];
  }

  /** User ids for those memberships (for time entry / report filters). */
  async userIdsForMemberships(membershipIds: string[]): Promise<string[]> {
    if (membershipIds.length === 0) return [];
    const rows = await this.prisma.membership.findMany({
      where: { id: { in: membershipIds } },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  private emptyIdFilter(): { id: { in: string[] } } {
    return { id: { in: [] } };
  }

  async projectWhere(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<Prisma.ProjectWhereInput> {
    const scope = scopeFor(membership.permissions, 'project', 'view');
    if (!scope) return this.emptyIdFilter();
    if (scope === 'all') return {};

    // STEP 1 — "own" = active project membership (not only tasks)
    const memberOf = await this.memberProjectIds(
      organisationId,
      membership.id,
    );

    if (scope === 'own') {
      return memberOf.length
        ? { id: { in: memberOf } }
        : this.emptyIdFilter();
    }

    // managed (+ own): projects I own ∪ projects I am a member of
    const managed = await this.managedProjectIds(
      organisationId,
      membership.id,
    );
    const ids = [...new Set([...memberOf, ...managed])];
    return ids.length ? { id: { in: ids } } : this.emptyIdFilter();
  }

  async taskWhere(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<Prisma.TaskWhereInput> {
    const scope = scopeFor(membership.permissions, 'task', 'view');
    if (!scope) return this.emptyIdFilter();
    if (scope === 'all') return {};

    // Members still only see tasks assigned to them (even on member projects)
    if (scope === 'own') {
      return { assigneeId: membership.id };
    }

    // managed: assigned to me OR on a project I own
    return {
      OR: [
        { assigneeId: membership.id },
        { project: { ownerId: membership.id } },
      ],
    };
  }

  async ticketWhere(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<Prisma.TicketWhereInput> {
    const scope = scopeFor(membership.permissions, 'ticket', 'view');
    if (!scope) return this.emptyIdFilter();
    if (scope === 'all') return {};

    // Tickets on projects the person is a member of (STEP 1)
    const memberOf = await this.memberProjectIds(
      organisationId,
      membership.id,
    );

    if (scope === 'own') {
      return memberOf.length
        ? { projectId: { in: memberOf } }
        : this.emptyIdFilter();
    }

    const managed = await this.managedProjectIds(
      organisationId,
      membership.id,
    );
    const ids = [...new Set([...memberOf, ...managed])];
    if (!ids.length) {
      return { project: { ownerId: membership.id } };
    }
    return {
      OR: [
        { projectId: { in: ids } },
        { project: { ownerId: membership.id } },
      ],
    };
  }

  async clientWhere(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<Prisma.ClientWhereInput> {
    const scope = scopeFor(membership.permissions, 'client', 'view');
    if (!scope) return this.emptyIdFilter();
    if (scope === 'all') return {};

    const projectVis = await this.projectWhere(organisationId, membership);
    const projects = await this.prisma.project.findMany({
      where: { organisationId, ...projectVis },
      select: { clientId: true },
      distinct: ['clientId'],
    });
    const clientIds = projects.map((p) => p.clientId);
    return clientIds.length
      ? { id: { in: clientIds } }
      : this.emptyIdFilter();
  }

  async membershipWhere(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<Prisma.MembershipWhereInput> {
    const scope = scopeFor(membership.permissions, 'member', 'view');
    if (!scope) return this.emptyIdFilter();
    if (scope === 'all') return {};

    // managed team (+ self)
    const ids = await this.managedMembershipIds(
      organisationId,
      membership.id,
    );
    return { id: { in: ids } };
  }

  /**
   * Time entries visibility from time_entry:edit scope.
   * own → only my userId; managed → self + direct reports; all → no user filter.
   */
  async timeEntryWhere(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
  ): Promise<Prisma.TimeEntryWhereInput> {
    const scope = scopeFor(membership.permissions, 'time_entry', 'edit');
    if (!scope) return { userId: { in: [] } };
    if (scope === 'all') return {};
    if (scope === 'own') return { userId };

    const membershipIds = await this.managedMembershipIds(
      organisationId,
      membership.id,
    );
    const userIds = await this.userIdsForMemberships(membershipIds);
    // Also include entries with lines on managed projects (PM viewing project time)
    const managedProjects = await this.managedProjectIds(
      organisationId,
      membership.id,
    );
    if (!managedProjects.length) {
      return { userId: { in: userIds.length ? userIds : [userId] } };
    }
    return {
      OR: [
        { userId: { in: userIds.length ? userIds : [userId] } },
        { timeLines: { some: { projectId: { in: managedProjects } } } },
      ],
    };
  }

  /**
   * Report lines: report:view scope.
   * own → my user only; managed → my projects OR my team; all → unrestricted.
   */
  async timeLineReportWhere(
    organisationId: string,
    membership: AuthMembership,
    userId: string,
  ): Promise<Prisma.TimeLineWhereInput> {
    const scope = scopeFor(membership.permissions, 'report', 'view');
    if (!scope) return { id: { in: [] } };
    if (scope === 'all') return {};

    if (scope === 'own') {
      return { timeEntry: { userId } };
    }

    const membershipIds = await this.managedMembershipIds(
      organisationId,
      membership.id,
    );
    const userIds = await this.userIdsForMemberships(membershipIds);
    const projectIds = [
      ...(await this.memberProjectIds(organisationId, membership.id)),
      ...(await this.managedProjectIds(organisationId, membership.id)),
    ];
    const uniqueProjects = [...new Set(projectIds)];

    const clauses: Prisma.TimeLineWhereInput[] = [
      { timeEntry: { userId: { in: userIds.length ? userIds : [userId] } } },
    ];
    if (uniqueProjects.length) {
      clauses.push({ projectId: { in: uniqueProjects } });
    }
    return { OR: clauses };
  }

  /** Resolve effective view scope for docs/tests. */
  viewScope(
    membership: AuthMembership,
    resource: string,
  ): PermissionScope | null {
    return scopeFor(membership.permissions, resource, 'view');
  }

  // ─── FIX 4 action assertions ─────────────────────────────────────────

  /**
   * FINAL FIX 1 — who may log time against a task.
   * Always requires the task to be assigned to this membership.
   * Scope `all` does NOT bypass (admins/owners logging their own time use the same rule).
   * "Log time for someone else" is not supported here.
   */
  async assertCanLogTime(
    organisationId: string,
    membership: AuthMembership,
    target: { taskId?: string | null; projectId?: string | null },
  ): Promise<void> {
    const scope = scopeFor(membership.permissions, 'time_entry', 'edit');
    if (!scope) {
      throw new ForbiddenException('You cannot log time');
    }

    const taskId = target.taskId ?? null;
    const projectId = target.projectId ?? null;

    // Bare entry (no task / project) — allowed; picker always supplies a task when chosen
    if (!taskId && !projectId) return;

    if (taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, organisationId },
        select: { assigneeId: true, projectId: true },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      if (task.assigneeId !== membership.id) {
        throw new ForbiddenException(
          'You can only log time on tasks assigned to you',
        );
      }
      return;
    }

    // Project without task: only if this user has at least one assigned task on it
    if (projectId) {
      const assigned = await this.assignedProjectIds(
        organisationId,
        membership.id,
      );
      if (assigned.includes(projectId)) return;
      throw new ForbiddenException(
        'You can only log time on projects where you have assigned tasks',
      );
    }
  }

  /**
   * project:edit all → any; managed → only projects.owner_id = me.
   * Used for update/archive. Create requires all (or managed with self as owner).
   */
  async assertCanEditProject(
    organisationId: string,
    membership: AuthMembership,
    projectId: string,
  ): Promise<void> {
    const scope = scopeFor(membership.permissions, 'project', 'edit');
    if (!scope) {
      throw new ForbiddenException('You cannot edit projects');
    }
    if (scope === 'all') return;

    const managed = await this.managedProjectIds(
      organisationId,
      membership.id,
    );
    if (!managed.includes(projectId)) {
      throw new ForbiddenException(
        'You can only edit projects you manage',
      );
    }
  }

  /** Creating a project: all may create; managed may create only as owner of the new row. */
  assertCanCreateProject(
    membership: AuthMembership,
    ownerId: string | null | undefined,
  ): void {
    const scope = scopeFor(membership.permissions, 'project', 'edit');
    if (!scope) {
      throw new ForbiddenException('You cannot create projects');
    }
    if (scope === 'all') return;
    if (scope === 'managed' && (ownerId === membership.id || !ownerId)) {
      return;
    }
    throw new ForbiddenException(
      'You can only create projects you will manage',
    );
  }

  /**
   * task:edit all → any; managed → task's project owned by me.
   */
  async assertCanEditTask(
    organisationId: string,
    membership: AuthMembership,
    taskId: string,
  ): Promise<void> {
    const scope = scopeFor(membership.permissions, 'task', 'edit');
    if (!scope) {
      throw new ForbiddenException('You cannot edit tasks');
    }
    if (scope === 'all') return;

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organisationId },
      select: { projectId: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanEditTaskOnProject(
      organisationId,
      membership,
      task.projectId,
    );
  }

  async assertCanEditTaskOnProject(
    organisationId: string,
    membership: AuthMembership,
    projectId: string,
  ): Promise<void> {
    const scope = scopeFor(membership.permissions, 'task', 'edit');
    if (!scope) {
      throw new ForbiddenException('You cannot edit tasks');
    }
    if (scope === 'all') return;

    const managed = await this.managedProjectIds(
      organisationId,
      membership.id,
    );
    if (!managed.includes(projectId)) {
      throw new ForbiddenException(
        'You can only edit tasks on projects you manage',
      );
    }
  }

  /**
   * FIX 5 — only billable:set may change project/task billable flags.
   * managed → project must be owned by the membership.
   */
  async assertCanSetBillable(
    organisationId: string,
    membership: AuthMembership,
    projectId: string,
  ): Promise<void> {
    const scope = scopeFor(membership.permissions, 'billable', 'set');
    if (!scope) {
      throw new ForbiddenException(
        'You cannot change billable settings',
      );
    }
    if (scope === 'all') return;

    const managed = await this.managedProjectIds(
      organisationId,
      membership.id,
    );
    if (!managed.includes(projectId)) {
      throw new ForbiddenException(
        'You can only set billable on projects you manage',
      );
    }
  }
}
