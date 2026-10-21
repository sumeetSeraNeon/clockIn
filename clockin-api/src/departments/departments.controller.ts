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
import {
  AddDepartmentMemberDto,
  CreateDepartmentDto,
  DepartmentRosterQueryDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { DepartmentsService } from './departments.service';

@Controller('departments')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  findAll(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Query() query: ListDepartmentsQueryDto,
  ) {
    return this.departments.findAll(organisationId, membership, query);
  }

  @Post()
  @RequirePermission('membership', 'edit')
  create(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departments.create(organisationId, membership, dto);
  }

  @Get(':id/roster')
  @RequirePermission('report', 'view')
  roster(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DepartmentRosterQueryDto,
  ) {
    return this.departments.roster(organisationId, membership, id, query);
  }

  @Get(':id')
  findOne(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.departments.findOne(organisationId, membership, id);
  }

  @Patch(':id')
  @RequirePermission('membership', 'edit')
  update(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departments.update(organisationId, membership, id, dto);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('membership', 'edit')
  addMember(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDepartmentMemberDto,
  ) {
    return this.departments.addMember(organisationId, membership, id, dto);
  }

  @Delete(':id/members/:membershipId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('membership', 'edit')
  removeMember(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.departments.removeMember(
      organisationId,
      membership,
      id,
      membershipId,
    );
  }
}
