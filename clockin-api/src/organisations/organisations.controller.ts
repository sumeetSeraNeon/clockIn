import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentMembership } from '../auth/decorators/current-membership.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { AuthMembership } from '../auth/auth.types';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { OrganisationsService } from './organisations.service';

@Controller('organisation')
@UseGuards(FirebaseAuthGuard)
export class OrganisationsController {
  constructor(private readonly organisations: OrganisationsService) {}

  @Get()
  get(@CurrentOrg() organisationId: string) {
    return this.organisations.get(organisationId);
  }

  @Patch()
  update(
    @CurrentOrg() organisationId: string,
    @CurrentMembership() membership: AuthMembership,
    @Body() dto: UpdateOrganisationDto,
  ) {
    return this.organisations.update(organisationId, membership, dto);
  }
}
