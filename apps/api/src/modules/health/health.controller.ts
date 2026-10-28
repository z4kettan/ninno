import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse } from '@ninno/contracts';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';

/** Served at `/health`, outside `/api/v1`, so infrastructure probes never change with API versions. */
@ApiTags('health')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(@InjectConfig() private readonly config: AppConfig) {}

  @Get()
  @ApiOkResponse({ description: 'The process can serve requests.' })
  check(): HealthResponse {
    return {
      status: 'ok',
      version: this.config.appVersion,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
