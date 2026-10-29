import { Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FileViewResponse, MyApplicationsResponse, ResidentFile } from '@ninno/contracts';
import type { Request } from 'express';
import {
  type AuthUser,
  CurrentUser,
  Roles,
  Tenant,
  type TenantContext,
} from '../../common/auth/auth.decorators';
import { ResidentFilesService } from './resident-files.service';
import { ResidentsService } from './residents.service';

const RESIDENT_FILES = { selfie: 'selfie', 'id-front': 'id-front', 'id-back': 'id-back' } as const;

@ApiTags('residents')
@ApiBearerAuth()
@Controller('residents')
export class ResidentsController {
  constructor(
    private readonly residents: ResidentsService,
    private readonly files: ResidentFilesService,
  ) {}

  /** The signed-in person's own applications; works across organisations. */
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MyApplicationsResponse> {
    return this.residents.myApplications(user.id);
  }

  /** A 5-minute link to view an applicant's selfie or ID; each call is audited. */
  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get(':residentId/files/:file')
  viewFile(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Param('file', new ParseEnumPipe(RESIDENT_FILES)) file: ResidentFile,
    @Req() req: Request,
  ): Promise<FileViewResponse> {
    return this.files.view(tenant, residentId, file, user.id, req.ip ?? null);
  }
}
