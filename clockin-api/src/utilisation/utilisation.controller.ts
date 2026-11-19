import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthMembership } from '../auth/auth.types';
import { CurrentMembership } from '../auth/decorators/current-membership.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ListLeaveQueryDto } from './dto/list-leave-query.dto';
import { UpsertLeaveDto } from './dto/upsert-leave.dto';
import { UpsertUtilisationMonthDto } from './dto/upsert-utilisation-month.dto';
import { UtilisationService } from './utilisation.service';

@Controller('utilisation')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class UtilisationController {
  constructor(private readonly utilisation: UtilisationService) {}

  @Get('months')
  listMonths(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
  ) {
    return this.utilisation.listMonths(organisationId, membership);
  }

  @Get('months/:yearMonth')
  getMonth(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('yearMonth') yearMonth: string,
  ) {
    return this.utilisation.getMonth(organisationId, membership, yearMonth);
  }

  @Put('months/:yearMonth')
  upsertMonth(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('yearMonth') yearMonth: string,
    @Body() dto: UpsertUtilisationMonthDto,
  ) {
    return this.utilisation.upsertMonth(
      organisationId,
      membership,
      yearMonth,
      dto,
    );
  }

  @Get('leave')
  @RequirePermission('member', 'view')
  listLeave(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Query() query: ListLeaveQueryDto,
  ) {
    return this.utilisation.listLeave(
      organisationId,
      membership,
      query.yearMonth,
    );
  }

  @Put('leave/:userId')
  upsertLeave(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('userId') userId: string,
    @Query() query: ListLeaveQueryDto,
    @Body() dto: UpsertLeaveDto,
  ) {
    return this.utilisation.upsertLeave(
      organisationId,
      membership,
      userId,
      query.yearMonth,
      dto,
    );
  }
}
