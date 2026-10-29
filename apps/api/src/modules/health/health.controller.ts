import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse } from '@ninno/contracts';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.decorators';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';
import { PrismaService } from '../../database/prisma.service';

/** Served at `/health`, outside `/api/v1`, so infrastructure probes never change with API versions. */
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @InjectConfig() private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'The process and its database can serve requests.' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is down.' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const database = (await this.prisma.isReachable(2000)) ? 'up' : 'down';
    const healthy = database === 'up';
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: healthy ? 'ok' : 'error',
      version: this.config.appVersion,
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
    };
  }
}
