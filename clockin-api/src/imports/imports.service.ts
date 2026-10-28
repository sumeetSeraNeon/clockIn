import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthMembership } from '../auth/auth.types';
import { can, scopeFor } from '../auth/permissions';
import { VisibilityService } from '../auth/visibility.service';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import {
  type ClientImportRowInput,
  type ClientImportRowResult,
  type ImportClientLookup,
  type ImportCommitResult,
  type ImportProjectLookup,
  type ProjectImportRowInput,
  type ProjectImportRowResult,
  type TaskImportRowInput,
  type TaskImportRowResult,
  type TicketImportRowInput,
  type TicketImportRowResult,
  IMPORT_MAX_ROWS,
  nameKey,
  normName,
  summarizeRows,
} from './import.types';
import {
  blankToNull,
  contactExternalIdText,
  normalizeInternalAgent,
  parseDurationSeconds,
  parseUkDateTime,
} from './ticket-import-parse';
import {
  normalizeTicketPriorityCode,
  normalizeTicketPriorityLabel,
  normalizeTicketStatusLabel,
  normalizeTicketTypeLabel,
} from '../tickets/ticket.constants';
import { AuditService } from '../audit/audit.service';

type NameMatch<T> =
  | { kind: 'none' }
  | { kind: 'one'; item: T }
  | { kind: 'ambiguous'; count: number };

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly clientsService: ClientsService,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
    private readonly audit: AuditService,
  ) {}

  async previewClients(
    organisationId: string,
    membership: AuthMembership,
    rows: ClientImportRowInput[],
  ) {
    this.assertRowCount(rows);
    this.assertCanEditClients(membership);
    const clients = await this.loadClients(organisationId, membership);
    const resultRows = this.validateClientRows(rows, clients);
    return {
      rows: resultRows,
      summary: summarizeRows(resultRows),
      lookups: { clients: this.toClientLookups(clients) },
    };
  }

  async commitClients(
    organisationId: string,
    membership: AuthMembership,
    rows: ClientImportRowInput[],
  ): Promise<ImportCommitResult> {
    this.assertRowCount(rows);
    this.assertCanEditClients(membership);
    const clients = await this.loadClients(organisationId, membership);
    const validated = this.validateClientRows(rows, clients);

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const createdKeys = new Set<string>();

    for (const row of validated) {
      if (row.excluded || row.status === 'excluded') {
        skipped += 1;
        continue;
      }
      if (row.status === 'skip') {
        skipped += 1;
        continue;
      }
      if (row.status === 'error') {
        errors += 1;
        continue;
      }

      const key = nameKey(row.clientName);
      if (createdKeys.has(key)) {
        skipped += 1;
        continue;
      }

      await this.clientsService.create(organisationId, membership.id, {
        name: normName(row.clientName),
      });
      createdKeys.add(key);
      created += 1;
    }

    return this.commitMessage(created, skipped, errors);
  }

  async previewProjects(
    organisationId: string,
    membership: AuthMembership,
    rows: ProjectImportRowInput[],
  ) {
    this.assertRowCount(rows);
    this.assertCanEditProjects(membership);
    const [clients, projects] = await Promise.all([
      this.loadClients(organisationId, membership),
      this.loadProjects(organisationId, membership),
    ]);
    const canCreateClient = can(membership.permissions, 'client', 'edit');
    const resultRows = this.validateProjectRows(
      rows,
      clients,
      projects,
      canCreateClient,
    );
    return {
      rows: resultRows,
      summary: summarizeRows(resultRows),
      lookups: {
        clients: this.toClientLookups(clients),
        projects: this.toProjectLookups(projects),
      },
      canCreateClient,
    };
  }

  async commitProjects(
    organisationId: string,
    membership: AuthMembership,
    rows: ProjectImportRowInput[],
  ): Promise<ImportCommitResult> {
    this.assertRowCount(rows);
    this.assertCanEditProjects(membership);
    const canCreateClient = can(membership.permissions, 'client', 'edit');

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Track clients/projects created earlier in this batch so later rows can resolve.
    const batchClients = new Map<string, { id: string; name: string }>();
    const batchProjects = new Set<string>(); // `${clientId}::${projectKey}`

    for (const raw of rows) {
      if (raw.excluded) {
        skipped += 1;
        continue;
      }

      // Fresh org state + batch overlays per row (order matters).
      const [clients, projects] = await Promise.all([
        this.loadClients(organisationId, membership),
        this.loadProjects(organisationId, membership),
      ]);
      for (const c of batchClients.values()) {
        if (!clients.some((x) => x.id === c.id)) {
          clients.push({ id: c.id, name: c.name, status: 'active' });
        }
      }

      const [row] = this.validateProjectRows(
        [raw],
        clients,
        projects,
        canCreateClient,
        batchProjects,
      );

      if (row.status === 'skip' || row.status === 'excluded') {
        skipped += 1;
        continue;
      }
      if (row.status === 'error') {
        errors += 1;
        continue;
      }

      let clientId = row.matchedClientId ?? null;
      if (!clientId && row.createClient) {
        const createdClient = await this.clientsService.create(
          organisationId,
          membership.id,
          { name: normName(row.clientName) },
        );
        clientId = createdClient.id;
        batchClients.set(nameKey(createdClient.name), {
          id: createdClient.id,
          name: createdClient.name,
        });
      }
      if (!clientId) {
        errors += 1;
        continue;
      }

      const project = await this.projectsService.create(
        organisationId,
        membership,
        {
          clientId,
          name: normName(row.projectName),
        },
      );
      batchProjects.add(`${clientId}::${nameKey(project.name)}`);
      created += 1;
    }

    return this.commitMessage(created, skipped, errors);
  }

  async previewTasks(
    organisationId: string,
    membership: AuthMembership,
    rows: TaskImportRowInput[],
  ) {
    this.assertRowCount(rows);
    this.assertCanEditTasks(membership);
    const [clients, projects, tasks] = await Promise.all([
      this.loadClients(organisationId, membership),
      this.loadProjects(organisationId, membership),
      this.loadTasks(organisationId, membership),
    ]);
    const canCreateClient = can(membership.permissions, 'client', 'edit');
    const canCreateProject = Boolean(
      scopeFor(membership.permissions, 'project', 'edit'),
    );
    const resultRows = this.validateTaskRows(
      rows,
      clients,
      projects,
      tasks,
      canCreateClient,
      canCreateProject,
    );
    return {
      rows: resultRows,
      summary: summarizeRows(resultRows),
      lookups: {
        clients: this.toClientLookups(clients),
        projects: this.toProjectLookups(projects),
      },
      canCreateClient,
      canCreateProject,
    };
  }

  async commitTasks(
    organisationId: string,
    membership: AuthMembership,
    rows: TaskImportRowInput[],
  ): Promise<ImportCommitResult> {
    this.assertRowCount(rows);
    this.assertCanEditTasks(membership);
    const canCreateClient = can(membership.permissions, 'client', 'edit');
    const canCreateProject = Boolean(
      scopeFor(membership.permissions, 'project', 'edit'),
    );

    let created = 0;
    let skipped = 0;
    let errors = 0;

    const batchClients = new Map<string, { id: string; name: string }>();
    const batchProjects = new Map<
      string,
      { id: string; name: string; clientId: string; clientName: string }
    >();
    const batchTasks = new Set<string>(); // `${projectId}::${taskKey}`

    for (const raw of rows) {
      if (raw.excluded) {
        skipped += 1;
        continue;
      }

      const [clients, projects, tasks] = await Promise.all([
        this.loadClients(organisationId, membership),
        this.loadProjects(organisationId, membership),
        this.loadTasks(organisationId, membership),
      ]);

      for (const c of batchClients.values()) {
        if (!clients.some((x) => x.id === c.id)) {
          clients.push({ id: c.id, name: c.name, status: 'active' });
        }
      }
      for (const p of batchProjects.values()) {
        if (!projects.some((x) => x.id === p.id)) {
          projects.push({
            id: p.id,
            name: p.name,
            clientId: p.clientId,
            clientName: p.clientName,
            status: 'active',
          });
        }
      }

      const [row] = this.validateTaskRows(
        [raw],
        clients,
        projects,
        tasks,
        canCreateClient,
        canCreateProject,
        batchTasks,
      );

      if (row.status === 'skip' || row.status === 'excluded') {
        skipped += 1;
        continue;
      }
      if (row.status === 'error') {
        errors += 1;
        continue;
      }

      let clientId = row.matchedClientId ?? null;
      let clientName = normName(row.clientName);

      if (!clientId && row.createClient) {
        const createdClient = await this.clientsService.create(
          organisationId,
          membership.id,
          { name: clientName },
        );
        clientId = createdClient.id;
        clientName = createdClient.name;
        batchClients.set(nameKey(createdClient.name), {
          id: createdClient.id,
          name: createdClient.name,
        });
      } else if (clientId) {
        const found = clients.find((c) => c.id === clientId);
        if (found) clientName = found.name;
      }

      if (!clientId) {
        errors += 1;
        continue;
      }

      let projectId = row.matchedProjectId ?? null;
      if (!projectId && row.createProject) {
        const createdProject = await this.projectsService.create(
          organisationId,
          membership,
          {
            clientId,
            name: normName(row.projectName),
          },
        );
        projectId = createdProject.id;
        batchProjects.set(`${clientId}::${nameKey(createdProject.name)}`, {
          id: createdProject.id,
          name: createdProject.name,
          clientId,
          clientName,
        });
      }

      if (!projectId) {
        errors += 1;
        continue;
      }

      await this.tasksService.create(organisationId, membership, {
        projectId,
        name: normName(row.taskName),
      });
      batchTasks.add(`${projectId}::${nameKey(row.taskName)}`);
      created += 1;
    }

    return this.commitMessage(created, skipped, errors);
  }

  // ─── validators ───────────────────────────────────────────────────────────

  private validateClientRows(
    rows: ClientImportRowInput[],
    clients: { id: string; name: string; status: string }[],
  ): ClientImportRowResult[] {
    const seenInFile = new Map<string, string>(); // key → first rowKey
    const active = clients.filter((c) => c.status !== 'archived');

    return rows.map((row) => {
      if (row.excluded) {
        return { ...row, status: 'excluded', reason: 'Removed from import' };
      }

      const name = normName(row.clientName);
      if (!name) {
        return {
          ...row,
          clientName: name,
          status: 'error',
          reason: 'Missing client name',
        };
      }

      const key = nameKey(name);
      const match = this.matchByName(active, key);

      if (match.kind === 'ambiguous') {
        return {
          ...row,
          clientName: name,
          status: 'error',
          reason: `Ambiguous client name '${name}' (${match.count} matches)`,
        };
      }

      if (match.kind === 'one') {
        return {
          ...row,
          clientName: name,
          status: 'skip',
          reason: 'Already exists',
          matchedClientId: match.item.id,
        };
      }

      const prior = seenInFile.get(key);
      if (prior) {
        return {
          ...row,
          clientName: name,
          status: 'skip',
          reason: 'Duplicate in this import',
        };
      }
      seenInFile.set(key, row.rowKey);

      return {
        ...row,
        clientName: name,
        status: 'create',
        matchedClientId: null,
      };
    });
  }

  private validateProjectRows(
    rows: ProjectImportRowInput[],
    clients: { id: string; name: string; status: string }[],
    projects: {
      id: string;
      name: string;
      clientId: string;
      clientName: string;
      status: string;
    }[],
    canCreateClient: boolean,
    batchProjectKeys?: Set<string>,
  ): ProjectImportRowResult[] {
    const seenInFile = new Map<string, string>();
    const activeClients = clients.filter((c) => c.status !== 'archived');
    const activeProjects = projects.filter((p) => p.status !== 'archived');

    return rows.map((row) => {
      if (row.excluded) {
        return { ...row, status: 'excluded', reason: 'Removed from import' };
      }

      const clientName = normName(row.clientName);
      const projectName = normName(row.projectName);

      if (!projectName) {
        return {
          ...row,
          clientName,
          projectName,
          status: 'error',
          reason: 'Missing project name',
        };
      }

      const clientResolved = this.resolveClient({
        clientName,
        clientId: row.clientId,
        createClient: row.createClient,
        clients: activeClients,
        canCreateClient,
      });

      if (clientResolved.status === 'error') {
        return {
          ...row,
          clientName,
          projectName,
          status: 'error',
          reason: clientResolved.reason,
          matchedClientId: null,
          matchedProjectId: null,
        };
      }

      const clientId = clientResolved.clientId;
      const effectiveClientName = clientResolved.clientName;

      if (clientId) {
        const underClient = activeProjects.filter((p) => p.clientId === clientId);
        const projectMatch = this.matchByName(underClient, nameKey(projectName));

        if (projectMatch.kind === 'ambiguous') {
          return {
            ...row,
            clientName: effectiveClientName,
            projectName,
            status: 'error',
            reason: `Ambiguous project '${projectName}' under client '${effectiveClientName}'`,
            matchedClientId: clientId,
            matchedProjectId: null,
          };
        }
        if (projectMatch.kind === 'one') {
          return {
            ...row,
            clientName: effectiveClientName,
            projectName,
            status: 'skip',
            reason: 'Already exists under this client',
            matchedClientId: clientId,
            matchedProjectId: projectMatch.item.id,
          };
        }
      }

      // Identity for duplicate-in-file: client key + project key
      // (use resolved client id when known, else name — same client name under create)
      const identityKey = `${clientId ?? `new:${nameKey(effectiveClientName)}`}::${nameKey(projectName)}`;
      if (seenInFile.has(identityKey) || batchProjectKeys?.has(identityKey)) {
        return {
          ...row,
          clientName: effectiveClientName,
          projectName,
          status: 'skip',
          reason: 'Duplicate in this import',
          matchedClientId: clientId,
          matchedProjectId: null,
        };
      }
      seenInFile.set(identityKey, row.rowKey);

      return {
        ...row,
        clientName: effectiveClientName,
        projectName,
        status: 'create',
        matchedClientId: clientId,
        matchedProjectId: null,
      };
    });
  }

  private validateTaskRows(
    rows: TaskImportRowInput[],
    clients: { id: string; name: string; status: string }[],
    projects: {
      id: string;
      name: string;
      clientId: string;
      clientName: string;
      status: string;
    }[],
    tasks: {
      id: string;
      name: string;
      projectId: string;
      status: string;
    }[],
    canCreateClient: boolean,
    canCreateProject: boolean,
    batchTaskKeys?: Set<string>,
  ): TaskImportRowResult[] {
    const seenInFile = new Map<string, string>();
    const activeClients = clients.filter((c) => c.status !== 'archived');
    const activeProjects = projects.filter((p) => p.status !== 'archived');
    const activeTasks = tasks.filter((t) => t.status !== 'archived');

    return rows.map((row) => {
      if (row.excluded) {
        return { ...row, status: 'excluded', reason: 'Removed from import' };
      }

      const taskName = normName(row.taskName);
      const projectName = normName(row.projectName);
      const clientName = normName(row.clientName);

      if (!taskName) {
        return {
          ...row,
          taskName,
          projectName,
          clientName,
          status: 'error',
          reason: 'Missing task name',
        };
      }
      if (!projectName) {
        return {
          ...row,
          taskName,
          projectName,
          clientName,
          status: 'error',
          reason: 'Missing project name',
        };
      }

      const clientResolved = this.resolveClient({
        clientName,
        clientId: row.clientId,
        createClient: row.createClient,
        clients: activeClients,
        canCreateClient,
      });

      if (clientResolved.status === 'error') {
        return {
          ...row,
          taskName,
          projectName,
          clientName,
          status: 'error',
          reason: clientResolved.reason,
          matchedClientId: null,
          matchedProjectId: null,
          matchedTaskId: null,
        };
      }

      const clientId = clientResolved.clientId;
      const effectiveClientName = clientResolved.clientName;

      const projectResolved = this.resolveProject({
        projectName,
        projectId: row.projectId,
        clientId,
        clientName: effectiveClientName,
        createProject: row.createProject,
        createClient: Boolean(row.createClient && !clientId),
        projects: activeProjects,
        canCreateProject,
      });

      if (projectResolved.status === 'error') {
        return {
          ...row,
          taskName,
          projectName,
          clientName: effectiveClientName,
          status: 'error',
          reason: projectResolved.reason,
          matchedClientId: clientId,
          matchedProjectId: null,
          matchedTaskId: null,
        };
      }

      const projectId = projectResolved.projectId;
      const effectiveProjectName = projectResolved.projectName;

      if (projectId) {
        const underProject = activeTasks.filter((t) => t.projectId === projectId);
        const taskMatch = this.matchByName(underProject, nameKey(taskName));
        if (taskMatch.kind === 'ambiguous') {
          return {
            ...row,
            taskName,
            projectName: effectiveProjectName,
            clientName: effectiveClientName,
            status: 'error',
            reason: `Ambiguous task '${taskName}' on this project`,
            matchedClientId: clientId,
            matchedProjectId: projectId,
            matchedTaskId: null,
          };
        }
        if (taskMatch.kind === 'one') {
          return {
            ...row,
            taskName,
            projectName: effectiveProjectName,
            clientName: effectiveClientName,
            status: 'skip',
            reason: 'Already exists on this project',
            matchedClientId: clientId,
            matchedProjectId: projectId,
            matchedTaskId: taskMatch.item.id,
          };
        }
      }

      const identityKey = `${projectId ?? `new:${clientId ?? nameKey(effectiveClientName)}:${nameKey(effectiveProjectName)}`}::${nameKey(taskName)}`;
      if (seenInFile.has(identityKey) || batchTaskKeys?.has(identityKey)) {
        return {
          ...row,
          taskName,
          projectName: effectiveProjectName,
          clientName: effectiveClientName,
          status: 'skip',
          reason: 'Duplicate in this import',
          matchedClientId: clientId,
          matchedProjectId: projectId,
          matchedTaskId: null,
        };
      }
      seenInFile.set(identityKey, row.rowKey);

      return {
        ...row,
        taskName,
        projectName: effectiveProjectName,
        clientName: effectiveClientName,
        status: 'create',
        matchedClientId: clientId,
        matchedProjectId: projectId,
        matchedTaskId: null,
      };
    });
  }

  private resolveClient(args: {
    clientName: string;
    clientId?: string | null;
    createClient?: boolean;
    clients: { id: string; name: string }[];
    canCreateClient: boolean;
  }):
    | { status: 'ok'; clientId: string | null; clientName: string }
    | { status: 'error'; reason: string } {
    const { clientName, clientId, createClient, clients, canCreateClient } =
      args;

    if (clientId) {
      const found = clients.find((c) => c.id === clientId);
      if (!found) {
        return {
          status: 'error',
          reason: 'Mapped client is not available in your organisation',
        };
      }
      return { status: 'ok', clientId: found.id, clientName: found.name };
    }

    if (!clientName) {
      return { status: 'error', reason: 'Missing client name' };
    }

    const match = this.matchByName(clients, nameKey(clientName));
    if (match.kind === 'ambiguous') {
      return {
        status: 'error',
        reason: `Ambiguous client name '${clientName}' (${match.count} matches) — pick one from the list`,
      };
    }
    if (match.kind === 'one') {
      return {
        status: 'ok',
        clientId: match.item.id,
        clientName: match.item.name,
      };
    }

    if (createClient) {
      if (!canCreateClient) {
        return {
          status: 'error',
          reason: `Client '${clientName}' not found — you cannot create clients`,
        };
      }
      return { status: 'ok', clientId: null, clientName };
    }

    return {
      status: 'error',
      reason: `Client '${clientName}' not found`,
    };
  }

  private resolveProject(args: {
    projectName: string;
    projectId?: string | null;
    clientId: string | null;
    clientName: string;
    createProject?: boolean;
    createClient: boolean;
    projects: {
      id: string;
      name: string;
      clientId: string;
      clientName: string;
    }[];
    canCreateProject: boolean;
  }):
    | { status: 'ok'; projectId: string | null; projectName: string }
    | { status: 'error'; reason: string } {
    const {
      projectName,
      projectId,
      clientId,
      clientName,
      createProject,
      createClient,
      projects,
      canCreateProject,
    } = args;

    if (projectId) {
      const found = projects.find((p) => p.id === projectId);
      if (!found) {
        return {
          status: 'error',
          reason: 'Mapped project is not available',
        };
      }
      if (clientId && found.clientId !== clientId) {
        return {
          status: 'error',
          reason: `Mapped project is not under client '${clientName}'`,
        };
      }
      return { status: 'ok', projectId: found.id, projectName: found.name };
    }

    // Must have a client (existing or about to create) before matching project-by-name.
    if (!clientId && !createClient) {
      return {
        status: 'error',
        reason: `Client '${clientName}' not found`,
      };
    }

    if (clientId) {
      const underClient = projects.filter((p) => p.clientId === clientId);
      const match = this.matchByName(underClient, nameKey(projectName));
      if (match.kind === 'ambiguous') {
        return {
          status: 'error',
          reason: `Ambiguous project '${projectName}' under client '${clientName}' — pick one`,
        };
      }
      if (match.kind === 'one') {
        return {
          status: 'ok',
          projectId: match.item.id,
          projectName: match.item.name,
        };
      }
    }

    if (createProject) {
      if (!canCreateProject) {
        return {
          status: 'error',
          reason: `Project '${projectName}' not found under '${clientName}' — you cannot create projects`,
        };
      }
      return { status: 'ok', projectId: null, projectName };
    }

    return {
      status: 'error',
      reason: `Project '${projectName}' not found under client '${clientName}'`,
    };
  }

  private matchByName<T extends { name: string }>(
    items: T[],
    key: string,
  ): NameMatch<T> {
    if (!key) return { kind: 'none' };
    const hits = items.filter((item) => nameKey(item.name) === key);
    if (hits.length === 0) return { kind: 'none' };
    if (hits.length === 1) return { kind: 'one', item: hits[0] };
    return { kind: 'ambiguous', count: hits.length };
  }

  // ─── data loaders (org-scoped + visibility) ───────────────────────────────

  private async loadClients(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<{ id: string; name: string; status: string }[]> {
    const visibilityWhere = await this.visibility.clientWhere(
      organisationId,
      membership,
    );
    return this.prisma.client.findMany({
      where: { organisationId, ...visibilityWhere },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  private async loadProjects(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<
    {
      id: string;
      name: string;
      clientId: string;
      clientName: string;
      status: string;
    }[]
  > {
    const visibilityWhere = await this.visibility.projectWhere(
      organisationId,
      membership,
    );
    const rows = await this.prisma.project.findMany({
      where: { organisationId, ...visibilityWhere },
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        client: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      clientId: p.clientId,
      clientName: p.client.name,
      status: p.status,
    }));
  }

  private async loadTasks(
    organisationId: string,
    membership: AuthMembership,
  ): Promise<{ id: string; name: string; projectId: string; status: string }[]> {
    const visibilityWhere = await this.visibility.taskWhere(
      organisationId,
      membership,
    );
    return this.prisma.task.findMany({
      where: { organisationId, ...visibilityWhere },
      select: { id: true, name: true, projectId: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  private toClientLookups(
    clients: { id: string; name: string; status: string }[],
  ): ImportClientLookup[] {
    return clients
      .filter((c) => c.status !== 'archived')
      .map((c) => ({ id: c.id, name: c.name }));
  }

  private toProjectLookups(
    projects: {
      id: string;
      name: string;
      clientId: string;
      clientName: string;
      status: string;
    }[],
  ): ImportProjectLookup[] {
    return projects
      .filter((p) => p.status !== 'archived')
      .map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.clientId,
        clientName: p.clientName,
      }));
  }

  async previewTickets(
    organisationId: string,
    membership: AuthMembership,
    rows: TicketImportRowInput[],
  ) {
    this.assertRowCount(rows);
    this.assertCanEditTickets(membership);
    const [clients, tickets, departments] = await Promise.all([
      this.loadClients(organisationId, membership),
      this.loadTicketsByReference(organisationId),
      this.loadDepartments(organisationId),
    ]);
    const resultRows = this.validateTicketRows(
      rows,
      clients,
      tickets,
      departments,
    );
    return {
      rows: resultRows,
      summary: summarizeRows(resultRows),
      lookups: { clients: this.toClientLookups(clients) },
    };
  }

  async commitTickets(
    organisationId: string,
    membership: AuthMembership,
    rows: TicketImportRowInput[],
  ): Promise<ImportCommitResult> {
    this.assertRowCount(rows);
    this.assertCanEditTickets(membership);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Fresh lookups each commit pass
    const clients = await this.loadClients(organisationId, membership);
    let tickets = await this.loadTicketsByReference(organisationId);
    const departments = await this.loadDepartments(organisationId);

    const validated = this.validateTicketRows(
      rows,
      clients,
      tickets,
      departments,
    );

    for (const row of validated) {
      if (row.excluded || row.status === 'excluded') {
        skipped += 1;
        continue;
      }
      if (row.status === 'skip') {
        skipped += 1;
        continue;
      }
      if (row.status === 'error' || !row.parsed || !row.matchedClientId) {
        errors += 1;
        continue;
      }

      const contactName =
        blankToNull(row.contactName) || blankToNull(row.agentName);
      const data = {
        clientId: row.matchedClientId,
        departmentId: row.matchedDepartmentId ?? null,
        reference: normName(row.reference),
        ticketType: row.parsed.ticketType,
        title: blankToNull(row.title),
        status: row.parsed.status,
        priority: row.parsed.priority,
        ticketPriority: row.parsed.ticketPriority,
        raisedBy: contactName,
        agentName: blankToNull(row.agentName),
        internalAgentName: row.parsed.internalAgentName,
        contactName,
        contactEmail: blankToNull(row.contactEmail),
        contactExternalId: contactExternalIdText(row.contactExternalId),
        source: blankToNull(row.source),
        tags: blankToNull(row.tags),
        workstream: blankToNull(row.workstream),
        openedAt: row.parsed.openedAt
          ? new Date(row.parsed.openedAt)
          : null,
        dueAt: row.parsed.dueAt ? new Date(row.parsed.dueAt) : null,
        resolvedAt: row.parsed.resolvedAt
          ? new Date(row.parsed.resolvedAt)
          : null,
        closedAt: row.parsed.closedAt
          ? new Date(row.parsed.closedAt)
          : null,
        initialResponseAt: row.parsed.initialResponseAt
          ? new Date(row.parsed.initialResponseAt)
          : null,
        firstResponseSeconds: row.parsed.firstResponseSeconds,
        resolutionSeconds: row.parsed.resolutionSeconds,
      };

      if (row.status === 'update' && row.matchedTicketId) {
        const existing = await this.prisma.ticket.findFirst({
          where: { id: row.matchedTicketId, organisationId },
        });
        if (!existing) {
          errors += 1;
          continue;
        }
        const saved = await this.prisma.ticket.update({
          where: { id: existing.id },
          data: {
            ...data,
            // Keep project if already assigned
            projectId: existing.projectId,
            resolvedAt:
              data.resolvedAt ??
              (data.status === 'resolved' && !existing.resolvedAt
                ? new Date()
                : existing.resolvedAt),
            closedAt:
              data.closedAt ??
              (data.status === 'closed' && !existing.closedAt
                ? new Date()
                : existing.closedAt),
          },
        });
        await this.audit.writeAudit({
          organisationId,
          actorMembershipId: membership.id,
          entityType: 'ticket',
          entityId: saved.id,
          action: 'update',
          oldValue: { reference: existing.reference, status: existing.status },
          newValue: { reference: saved.reference, status: saved.status },
        });
        updated += 1;
        tickets.set(nameKey(saved.reference), {
          id: saved.id,
          reference: saved.reference,
        });
        continue;
      }

      const saved = await this.prisma.ticket.create({
        data: {
          organisationId,
          ...data,
          openedAt: data.openedAt ?? new Date(),
          resolvedAt:
            data.resolvedAt ??
            (data.status === 'resolved' ? new Date() : null),
          closedAt:
            data.closedAt ?? (data.status === 'closed' ? new Date() : null),
        },
      });
      await this.audit.writeAudit({
        organisationId,
        actorMembershipId: membership.id,
        entityType: 'ticket',
        entityId: saved.id,
        action: 'create',
        newValue: { reference: saved.reference, status: saved.status },
      });
      created += 1;
      tickets.set(nameKey(saved.reference), {
        id: saved.id,
        reference: saved.reference,
      });
    }

    return this.commitMessage(created, skipped, errors, updated);
  }

  private validateTicketRows(
    rows: TicketImportRowInput[],
    clients: { id: string; name: string }[],
    tickets: Map<string, { id: string; reference: string }>,
    departments: { id: string; name: string }[],
  ): TicketImportRowResult[] {
    const clientsByKey = new Map(
      clients.map((c) => [nameKey(c.name), c] as const),
    );
    const departmentsByKey = new Map(
      departments.map((d) => [nameKey(d.name), d] as const),
    );

    return rows.map((row) => {
      if (row.excluded) {
        return { ...row, status: 'excluded' as const };
      }

      const reference = normName(row.reference);
      const title = normName(row.title);
      const clientName =
        normName(row.clientName) || normName(row.tags ?? '') || '';

      if (!reference) {
        return {
          ...row,
          status: 'error' as const,
          reason: 'Ticket ID is required',
        };
      }
      if (!title) {
        return {
          ...row,
          status: 'error' as const,
          reason: 'Subject is required',
        };
      }
      if (!clientName && !row.clientId) {
        return {
          ...row,
          status: 'error' as const,
          reason: 'Client (or Tags) is required',
        };
      }

      let matchedClient =
        row.clientId != null
          ? clients.find((c) => c.id === row.clientId) ?? null
          : null;
      if (!matchedClient && clientName) {
        matchedClient = clientsByKey.get(nameKey(clientName)) ?? null;
      }
      if (!matchedClient) {
        return {
          ...row,
          clientName,
          status: 'error' as const,
          reason: `Client "${clientName || row.clientName}" not found in ClockIn`,
        };
      }

      const ticketType = normalizeTicketTypeLabel(row.ticketType);
      if (!ticketType) {
        return {
          ...row,
          clientName,
          status: 'error' as const,
          reason: `Unknown Type "${row.ticketType}"`,
          matchedClientId: matchedClient.id,
        };
      }

      const status = normalizeTicketStatusLabel(row.status);
      if (!status) {
        return {
          ...row,
          clientName,
          status: 'error' as const,
          reason: `Unknown Status "${row.status}"`,
          matchedClientId: matchedClient.id,
        };
      }

      const priority = row.priority
        ? normalizeTicketPriorityLabel(row.priority)
        : null;
      if (row.priority?.trim() && !priority) {
        return {
          ...row,
          clientName,
          status: 'error' as const,
          reason: `Unknown Priority "${row.priority}"`,
          matchedClientId: matchedClient.id,
        };
      }

      const ticketPriority = row.ticketPriority
        ? normalizeTicketPriorityCode(row.ticketPriority)
        : null;
      if (row.ticketPriority?.trim() && !ticketPriority) {
        return {
          ...row,
          clientName,
          status: 'error' as const,
          reason: `Unknown Ticket Priority "${row.ticketPriority}"`,
          matchedClientId: matchedClient.id,
        };
      }

      const dateFields: Array<[string, string | null | undefined]> = [
        ['Created time', row.openedAt],
        ['Due by Time', row.dueAt],
        ['Resolved time', row.resolvedAt],
        ['Closed time', row.closedAt],
        ['Initial response time', row.initialResponseAt],
      ];
      const parsedDates: Record<string, string | null> = {};
      for (const [label, raw] of dateFields) {
        if (!raw?.trim()) {
          parsedDates[label] = null;
          continue;
        }
        const d = parseUkDateTime(raw);
        if (!d) {
          return {
            ...row,
            clientName,
            status: 'error' as const,
            reason: `Could not read ${label}: "${raw}"`,
            matchedClientId: matchedClient.id,
          };
        }
        parsedDates[label] = d.toISOString();
      }

      const firstResponseSeconds = row.firstResponseDuration?.trim()
        ? parseDurationSeconds(row.firstResponseDuration)
        : null;
      if (
        row.firstResponseDuration?.trim() &&
        firstResponseSeconds === null
      ) {
        return {
          ...row,
          clientName,
          status: 'error' as const,
          reason: `Could not read First response time: "${row.firstResponseDuration}"`,
          matchedClientId: matchedClient.id,
        };
      }

      const resolutionSeconds = row.resolutionDuration?.trim()
        ? parseDurationSeconds(row.resolutionDuration)
        : null;
      if (row.resolutionDuration?.trim() && resolutionSeconds === null) {
        return {
          ...row,
          clientName,
          status: 'error' as const,
          reason: `Could not read Resolution time: "${row.resolutionDuration}"`,
          matchedClientId: matchedClient.id,
        };
      }

      const groupName = normName(row.groupName);
      let matchedDepartment: { id: string; name: string } | null = null;
      if (groupName) {
        matchedDepartment = departmentsByKey.get(nameKey(groupName)) ?? null;
        if (!matchedDepartment) {
          return {
            ...row,
            clientName,
            status: 'error' as const,
            reason: `Department "${groupName}" not found`,
            matchedClientId: matchedClient.id,
          };
        }
      }

      const existingTicket = tickets.get(nameKey(reference)) ?? null;

      return {
        ...row,
        clientName,
        reference,
        title,
        status: existingTicket ? ('update' as const) : ('create' as const),
        matchedClientId: matchedClient.id,
        matchedTicketId: existingTicket?.id ?? null,
        matchedDepartmentId: matchedDepartment?.id ?? null,
        parsed: {
          ticketType,
          status,
          priority,
          ticketPriority,
          openedAt: parsedDates['Created time'] ?? null,
          dueAt: parsedDates['Due by Time'] ?? null,
          resolvedAt: parsedDates['Resolved time'] ?? null,
          closedAt: parsedDates['Closed time'] ?? null,
          initialResponseAt: parsedDates['Initial response time'] ?? null,
          firstResponseSeconds,
          resolutionSeconds,
          internalAgentName: normalizeInternalAgent(row.internalAgentName),
        },
      };
    });
  }

  private async loadTicketsByReference(organisationId: string) {
    const rows = await this.prisma.ticket.findMany({
      where: { organisationId },
      select: { id: true, reference: true },
    });
    return new Map(rows.map((r) => [nameKey(r.reference), r] as const));
  }

  private async loadDepartments(organisationId: string) {
    return this.prisma.department.findMany({
      where: { organisationId, status: 'active' },
      select: { id: true, name: true },
    });
  }

  // ─── guards / helpers ─────────────────────────────────────────────────────

  private assertRowCount(rows: unknown[]): void {
    if (!rows.length) {
      throw new BadRequestException('No rows to import');
    }
    if (rows.length > IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `Import is limited to ${IMPORT_MAX_ROWS} rows`,
      );
    }
  }

  private assertCanEditClients(membership: AuthMembership): void {
    if (!can(membership.permissions, 'client', 'edit')) {
      throw new ForbiddenException('You cannot import clients');
    }
  }

  private assertCanEditProjects(membership: AuthMembership): void {
    if (!scopeFor(membership.permissions, 'project', 'edit')) {
      throw new ForbiddenException('You cannot import projects');
    }
  }

  private assertCanEditTasks(membership: AuthMembership): void {
    if (!scopeFor(membership.permissions, 'task', 'edit')) {
      throw new ForbiddenException('You cannot import tasks');
    }
  }

  private assertCanEditTickets(membership: AuthMembership): void {
    if (!can(membership.permissions, 'ticket', 'edit')) {
      throw new ForbiddenException('You cannot import tickets');
    }
  }

  private commitMessage(
    created: number,
    skipped: number,
    errors: number,
    updated = 0,
  ): ImportCommitResult {
    const parts = [`${created} created`];
    if (updated > 0) parts.push(`${updated} updated`);
    parts.push(`${skipped} skipped`);
    if (errors > 0) parts.push(`${errors} errored`);
    return {
      created,
      updated,
      skipped,
      errors,
      message: parts.join(', '),
    };
  }
}
