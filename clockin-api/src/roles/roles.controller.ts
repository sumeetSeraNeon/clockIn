import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('member', 'view')
  findAll(@CurrentOrg() organisationId: string) {
    return this.rolesService.findAll(organisationId);
  }
}
