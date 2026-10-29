import { type DynamicModule, type ExecutionContext, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AUTH_THROTTLED } from '../common/auth/auth.decorators';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { ClockModule } from '../common/clock';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import { buildLoggerOptions } from '../common/logging/logger.options';
import { ConfigModule } from '../config/config.module';
import type { AppConfig } from '../config/env.schema';
import { PrismaModule } from '../database/prisma.module';
import { ApprovalsModule } from '../modules/approvals/approvals.module';
import { AuditModule } from '../modules/audit/audit.module';
import { AuthModule } from '../modules/auth/auth.module';
import { HealthModule } from '../modules/health/health.module';
import { HostelsModule } from '../modules/hostels/hostels.module';
import { OnboardingModule } from '../modules/onboarding/onboarding.module';
import { ResidentsModule } from '../modules/residents/residents.module';

const isAuthThrottled = (context: ExecutionContext): boolean =>
  Reflect.getMetadata(AUTH_THROTTLED, context.getHandler()) === true;

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        LoggerModule.forRoot(buildLoggerOptions(config)),
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60_000, limit: config.rateLimitPerMinute },
          // Stricter per-IP limit, only on routes marked @AuthThrottled() (OTP request/verify).
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.authRateLimitPerMinute,
            skipIf: (context) => !isAuthThrottled(context),
          },
        ]),
        // Daily jobs (e.g. sweeping abandoned uploads). No queue yet; see the add-qr-onboarding design.
        ScheduleModule.forRoot(),
        ClockModule,
        PrismaModule,
        AuditModule,
        AuthModule,
        ApprovalsModule,
        HealthModule,
        HostelsModule,
        OnboardingModule,
        ResidentsModule,
      ],
      providers: [
        // Guards run in this order: rate limit, authentication, tenant resolution, roles.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: TenantGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }
}
