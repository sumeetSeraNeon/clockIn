import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthMembership } from '../auth/auth.types';
import { CurrentMembership } from '../auth/decorators/current-membership.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import {
  ReportApprovalsQueryDto,
  ReportBudgetQueryDto,
  ReportDetailedQueryDto,
  ReportSummaryQueryDto,
  ReportUtilisationQueryDto,
} from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @RequirePermission('report', 'view')
  summary(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @CurrentUser() user: User,
    @Query() query: ReportSummaryQueryDto,
  ) {
    return this.reportsService.summary(
      organisationId,
      membership,
      user.id,
      query,
    );
  }

  @Get('detailed')
  @RequirePermission('report', 'view')
  detailed(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @CurrentUser() user: User,
    @Query() query: ReportDetailedQueryDto,
  ) {
    return this.reportsService.detailed(
      organisationId,
      membership,
      user.id,
      query,
    );
  }

  @Get('budget')
  @RequirePermission('report', 'view')
  budget(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @CurrentUser() user: User,
    @Query() query: ReportBudgetQueryDto,
  ) {
    return this.reportsService.budget(
      organisationId,
      membership,
      user.id,
      query,
    );
  }

  @Get('approvals')
  @RequirePermission('report', 'view')
  approvals(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @CurrentUser() user: User,
    @Query() query: ReportApprovalsQueryDto,
  ) {
    return this.reportsService.approvalsReport(
      organisationId,
      membership,
      user.id,
      query,
    );
  }

  /** STEP 3 — billable utilisation per person */
  @Get('utilisation')
  @RequirePermission('report', 'view')
  utilisation(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @CurrentUser() user: User,
    @Query() query: ReportUtilisationQueryDto,
  ) {
    return this.reportsService.utilisation(
      organisationId,
      membership,
      user.id,
      query,
    );
  }
}
