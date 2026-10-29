import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ApprovalCountResponse,
  ApprovalDecisionResponse,
  ApprovalDetailResponse,
  ApprovalListResponse,
} from '@ninno/contracts';
import {
  type AuthUser,
  CurrentUser,
  Roles,
  Tenant,
  type TenantContext,
} from '../../common/auth/auth.decorators';
import { ApprovalsService } from './approvals.service';
import { ApproveDto, RejectDto } from './dto/decision.dto';

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  /** Applications waiting for review, oldest first. */
  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get()
  list(@Tenant() tenant: TenantContext): Promise<ApprovalListResponse> {
    return this.approvals.list(tenant);
  }

  /** For the badge in the navigation. */
  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get('count')
  count(@Tenant() tenant: TenantContext): Promise<ApprovalCountResponse> {
    return this.approvals.count(tenant);
  }

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get(':residentId')
  detail(
    @Tenant() tenant: TenantContext,
    @Param('residentId', ParseUUIDPipe) residentId: string,
  ): Promise<ApprovalDetailResponse> {
    return this.approvals.detail(tenant, residentId);
  }

  @Roles('OWNER', 'MANAGER')
  @Post(':residentId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Body() dto: ApproveDto,
  ): Promise<ApprovalDecisionResponse> {
    return this.approvals.approve(tenant, residentId, dto, user.id);
  }

  @Roles('OWNER', 'MANAGER')
  @Post(':residentId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Body() dto: RejectDto,
  ): Promise<ApprovalDecisionResponse> {
    return this.approvals.reject(tenant, residentId, dto.reason, user.id);
  }
}
