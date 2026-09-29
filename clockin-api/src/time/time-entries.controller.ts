import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthMembership } from '../auth/auth.types';
import { CurrentMembership } from '../auth/decorators/current-membership.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { CreateTimeLineDto } from './dto/create-time-line.dto';
import { ListTimeEntriesQueryDto } from './dto/list-time-entries-query.dto';
import { StopTimeEntryDto } from './dto/stop-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TimeService } from './time.service';

@Controller('time-entries')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class TimeEntriesController {
  constructor(private readonly timeService: TimeService) {}

  @Post()
  @RequirePermission('time_entry', 'edit')
  create(
    @CurrentOrg() organisationId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.timeService.createEntry(
      organisationId,
      membership,
      user.id,
      dto,
    );
  }

  @Get()
  @RequirePermission('time_entry', 'edit')
  findAll(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @CurrentUser() user: User,
    @Query() query: ListTimeEntriesQueryDto,
  ) {
    return this.timeService.listEntries(
      organisationId,
      membership,
      user.id,
      query,
    );
  }

  @Get(':id')
  @RequirePermission('time_entry', 'edit')
  findOne(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timeService.getEntry(
      organisationId,
      membership,
      user.id,
      id,
    );
  }

  @Patch(':id')
  @RequirePermission('time_entry', 'edit')
  update(
    @CurrentOrg() organisationId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.timeService.updateEntry(
      organisationId,
      membership,
      user.id,
      id,
      dto,
    );
  }

  @Patch(':id/stop')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('time_entry', 'edit')
  stop(
    @CurrentOrg() organisationId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StopTimeEntryDto,
  ) {
    return this.timeService.stopEntry(
      organisationId,
      membership,
      user.id,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('time_entry', 'edit')
  remove(
    @CurrentOrg() organisationId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timeService.deleteEntry(
      organisationId,
      membership,
      user.id,
      id,
    );
  }

  @Post(':id/lines')
  @RequirePermission('time_entry', 'edit')
  addLine(
    @CurrentOrg() organisationId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTimeLineDto,
  ) {
    return this.timeService.addLine(
      organisationId,
      membership,
      user.id,
      id,
      dto,
    );
  }
}
