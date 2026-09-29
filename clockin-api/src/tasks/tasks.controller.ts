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
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequirePermission('task', 'edit')
  create(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(organisationId, membership, dto);
  }

  @Get()
  @RequirePermission('task', 'view')
  findAll(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.findAll(organisationId, membership, query);
  }

  @Get(':id')
  @RequirePermission('task', 'view')
  findOne(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.findOne(organisationId, membership, id);
  }

  @Patch(':id')
  @RequirePermission('task', 'edit')
  update(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(organisationId, membership, id, dto);
  }

  @Delete(':id')
  @RequirePermission('task', 'edit')
  remove(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.archive(organisationId, membership, id);
  }
}
