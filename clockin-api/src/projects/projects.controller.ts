import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthMembership } from '../auth/auth.types';
import { CurrentMembership } from '../auth/decorators/current-membership.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequirePermission('project', 'edit')
  create(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(organisationId, membership, dto);
  }

  @Get()
  @RequirePermission('project', 'view')
  findAll(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Query() query: ListProjectsQueryDto,
  ) {
    return this.projectsService.findAll(organisationId, membership, query);
  }

  @Get(':id')
  @RequirePermission('project', 'view')
  findOne(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.findOne(organisationId, membership, id);
  }

  @Patch(':id')
  @RequirePermission('project', 'edit')
  update(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(organisationId, membership, id, dto);
  }

  @Delete(':id')
  @RequirePermission('project', 'edit')
  remove(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.archive(organisationId, membership, id);
  }
}
