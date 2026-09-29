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
import type { AuthMembership } from '../auth/auth.types';
import { CurrentMembership } from '../auth/decorators/current-membership.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateMemberRolesDto } from './dto/update-member-roles.dto';
import { MembersService } from './members.service';

@Controller('members')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @RequirePermission('member', 'view')
  findAll(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Query() query: ListMembersQueryDto,
  ) {
    return this.membersService.findAll(organisationId, membership, query);
  }

  @Post('invite')
  @RequirePermission('membership', 'edit')
  invite(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.invite(organisationId, membership.id, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('membership', 'edit')
  approve(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.approve(organisationId, membership.id, id);
  }

  @Patch(':id')
  @RequirePermission('membership', 'edit')
  update(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(
      organisationId,
      membership.id,
      id,
      dto,
    );
  }

  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('membership', 'edit')
  updateRoles(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberRolesDto,
  ) {
    return this.membersService.updateRoles(
      organisationId,
      membership.id,
      id,
      dto,
    );
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('membership', 'edit')
  deactivate(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.deactivate(
      organisationId,
      membership.id,
      id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('membership', 'edit')
  remove(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.remove(organisationId, membership.id, id);
  }
}
