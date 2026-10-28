import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import { buildLoggerOptions } from '../common/logging/logger.options';
import { ConfigModule } from '../config/config.module';
import type { AppConfig } from '../config/env.schema';
import { HealthModule } from '../modules/health/health.module';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        LoggerModule.forRoot(buildLoggerOptions(config)),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: config.rateLimitPerMinute }]),
        HealthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }
}
