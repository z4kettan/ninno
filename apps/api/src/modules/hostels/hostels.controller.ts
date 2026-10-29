import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { HostelSummary } from '@ninno/contracts';
import { Roles, Tenant, type TenantContext } from '../../common/auth/auth.decorators';
import { hostelScope } from '../../common/auth/hostel-scope';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('hostels')
@ApiBearerAuth()
@Controller('hostels')
export class HostelsController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles('OWNER', 'MANAGER', 'STAFF')
  @Get()
  list(@Tenant() tenant: TenantContext): Promise<HostelSummary[]> {
    return this.prisma.hostel.findMany({
      where: hostelScope(tenant),
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    });
  }
}
