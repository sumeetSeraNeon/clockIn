import {
  Body,
  Controller,
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
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

/**
 * FINAL FIX 9 — ticket:view for list/detail; ticket:edit for create/update
 * (members view-only; PM/admin/owner edit).
 */
@Controller('tickets')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @RequirePermission('ticket', 'edit')
  create(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.create(organisationId, membership.id, dto);
  }

  @Get()
  @RequirePermission('ticket', 'view')
  findAll(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Query() query: ListTicketsQueryDto,
  ) {
    return this.ticketsService.findAll(organisationId, membership, query);
  }

  @Get(':id')
  @RequirePermission('ticket', 'view')
  findOne(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ticketsService.findOne(organisationId, membership, id);
  }

  @Patch(':id')
  @RequirePermission('ticket', 'edit')
  update(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(
      organisationId,
      membership.id,
      id,
      dto,
    );
  }
}
