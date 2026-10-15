import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthMembership } from '../auth/auth.types';
import { CurrentMembership } from '../auth/decorators/current-membership.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import {
  ClientImportCommitDto,
  ClientImportPreviewDto,
} from './dto/client-import.dto';
import {
  ProjectImportCommitDto,
  ProjectImportPreviewDto,
} from './dto/project-import.dto';
import {
  TaskImportCommitDto,
  TaskImportPreviewDto,
} from './dto/task-import.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('clients/preview')
  @RequirePermission('client', 'edit')
  previewClients(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: ClientImportPreviewDto,
  ) {
    return this.importsService.previewClients(
      organisationId,
      membership,
      dto.rows,
    );
  }

  @Post('clients/commit')
  @RequirePermission('client', 'edit')
  commitClients(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: ClientImportCommitDto,
  ) {
    return this.importsService.commitClients(
      organisationId,
      membership,
      dto.rows,
    );
  }

  @Post('projects/preview')
  @RequirePermission('project', 'edit')
  previewProjects(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: ProjectImportPreviewDto,
  ) {
    return this.importsService.previewProjects(
      organisationId,
      membership,
      dto.rows,
    );
  }

  @Post('projects/commit')
  @RequirePermission('project', 'edit')
  commitProjects(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: ProjectImportCommitDto,
  ) {
    return this.importsService.commitProjects(
      organisationId,
      membership,
      dto.rows,
    );
  }

  @Post('tasks/preview')
  @RequirePermission('task', 'edit')
  previewTasks(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: TaskImportPreviewDto,
  ) {
    return this.importsService.previewTasks(
      organisationId,
      membership,
      dto.rows,
    );
  }

  @Post('tasks/commit')
  @RequirePermission('task', 'edit')
  commitTasks(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: TaskImportCommitDto,
  ) {
    return this.importsService.commitTasks(
      organisationId,
      membership,
      dto.rows,
    );
  }
}
