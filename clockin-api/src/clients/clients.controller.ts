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
import { CurrentMembership } from '../auth/decorators/current-membership.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import type { AuthMembership } from '../auth/auth.types';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @RequirePermission('client', 'edit')
  create(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(organisationId, membership.id, dto);
  }

  @Get()
  @RequirePermission('client', 'view')
  findAll(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Query() query: ListClientsQueryDto,
  ) {
    return this.clientsService.findAll(organisationId, membership, query);
  }

  @Get(':id')
  @RequirePermission('client', 'view')
  findOne(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.findOne(organisationId, membership, id);
  }

  @Patch(':id')
  @RequirePermission('client', 'edit')
  update(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(
      organisationId,
      membership.id,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermission('client', 'edit')
  remove(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.archive(organisationId, membership.id, id);
  }
}
