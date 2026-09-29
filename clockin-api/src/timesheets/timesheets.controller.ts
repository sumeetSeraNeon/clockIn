import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { GetMineTimesheetQueryDto } from './dto/get-mine-query.dto';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { TimesheetsService } from './timesheets.service';

@Controller('timesheets')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  /** Caller's week status + whether they can submit. */
  @Get('me')
  @RequirePermission('time_entry', 'edit')
  getMine(
    @CurrentOrg() organisationId: string,
    @CurrentUser() user: User,
    @Query() query: GetMineTimesheetQueryDto,
  ) {
    return this.timesheets.getMine(
      organisationId,
      user.id,
      query.periodStart,
      query.periodEnd,
    );
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('time_entry', 'edit')
  submit(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @CurrentUser() user: User,
    @Body() dto: SubmitTimesheetDto,
  ) {
    return this.timesheets.submit(
      organisationId,
      membership,
      user.id,
      dto,
    );
  }

  @Get('pending')
  @RequirePermission('timesheet', 'approve')
  listPending(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
  ) {
    return this.timesheets.listPending(organisationId, membership);
  }

  /** `:id` is a timesheet period slice id (per-project approval unit). */
  @Post(':id/lines/:lineId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('timesheet', 'approve')
  approveLine(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.timesheets.approveLine(
      organisationId,
      membership,
      id,
      lineId,
    );
  }

  /** `:id` is a timesheet period slice id (per-project approval unit). */
  @Post(':id/lines/:lineId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('timesheet', 'approve')
  rejectLine(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: RejectTimesheetDto,
  ) {
    return this.timesheets.rejectLine(
      organisationId,
      membership,
      id,
      lineId,
      dto,
    );
  }

  /** `:id` is a timesheet period slice id (per-project approval unit). */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('timesheet', 'approve')
  approve(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timesheets.approve(organisationId, membership, id);
  }

  /** `:id` is a timesheet period slice id (per-project approval unit). */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('timesheet', 'approve')
  reject(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTimesheetDto,
  ) {
    return this.timesheets.reject(organisationId, membership, id, dto);
  }
}
