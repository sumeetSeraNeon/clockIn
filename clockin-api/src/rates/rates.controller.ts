import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateRateDto } from './dto/create-rate.dto';
import { ListRatesQueryDto } from './dto/list-rates-query.dto';
import { LookupRateDto } from './dto/lookup-rate.dto';
import { RatesService } from './rates.service';

@Controller('rates')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Post()
  @RequirePermission('rate', 'edit')
  create(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: CreateRateDto,
  ) {
    return this.ratesService.create(organisationId, membership.id, dto);
  }

  @Get()
  @RequirePermission('rate', 'view')
  findAll(
    @CurrentOrg() organisationId: string,
    @Query() query: ListRatesQueryDto,
  ) {
    return this.ratesService.findAll(organisationId, query);
  }

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rate', 'view')
  lookup(
    @CurrentOrg() organisationId: string,
    @Body() dto: LookupRateDto,
  ) {
    return this.ratesService.lookup(organisationId, dto);
  }
}
