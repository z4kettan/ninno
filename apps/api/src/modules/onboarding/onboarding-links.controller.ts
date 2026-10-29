import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { OnboardingLinkResponse } from '@ninno/contracts';
import {
  type AuthUser,
  CurrentUser,
  Roles,
  Tenant,
  type TenantContext,
} from '../../common/auth/auth.decorators';
import { OnboardingLinksService } from './onboarding-links.service';

@ApiTags('onboarding')
@ApiBearerAuth()
@Controller('hostels/:hostelId/onboarding-link')
export class OnboardingLinksController {
  constructor(private readonly links: OnboardingLinksService) {}

  /** The hostel's QR link, created on the first visit to the QR screen. */
  @Roles('OWNER', 'MANAGER')
  @Get()
  get(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<OnboardingLinkResponse> {
    return this.links.getOrCreate(tenant, hostelId, user.id);
  }

  @Roles('OWNER', 'MANAGER')
  @Post('rotate')
  @HttpCode(HttpStatus.OK)
  rotate(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<OnboardingLinkResponse> {
    return this.links.rotate(tenant, hostelId, user.id);
  }
}
