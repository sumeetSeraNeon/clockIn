import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateTimeLineDto } from './dto/update-time-line.dto';
import { TimeService } from './time.service';

@Controller('time-lines')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class TimeLinesController {
  constructor(private readonly timeService: TimeService) {}

  @Patch(':id')
  @RequirePermission('time_entry', 'edit')
  update(
    @CurrentOrg() organisationId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeLineDto,
  ) {
    return this.timeService.updateLine(
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
    return this.timeService.deleteLine(
      organisationId,
      membership,
      user.id,
      id,
    );
  }
}
