import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app/app.module';
import { configureApp } from '../../src/app/configure-app';
import { CLOCK } from '../../src/common/clock';
import { PrismaService } from '../../src/database/prisma.service';
import { OTP_SENDER } from '../../src/modules/auth/otp/otp-sender';
import { CapturingOtpSender, TestClock } from '../auth-doubles';
import { testConfig } from '../test-config';
import { runDatabaseUrl, testStorageEnv } from './env';

export interface TestApp {
  app: NestExpressApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  sender: CapturingOtpSender;
  clock: TestClock;
}

/** The real application against this run's throwaway database, with SMS and time faked. */
export async function createTestApp(
  options: { env?: Record<string, string>; controllers?: Type[] } = {},
): Promise<TestApp> {
  const config = testConfig({
    DATABASE_URL: runDatabaseUrl(),
    RATE_LIMIT_PER_MINUTE: '10000',
    AUTH_RATE_LIMIT_PER_MINUTE: '10000',
    ...testStorageEnv(),
    ...options.env,
  });
  const sender = new CapturingOtpSender();
  const clock = new TestClock(new Date().toISOString());
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config)],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(OTP_SENDER)
    .useValue(sender)
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app, config);
  await app.init();
  return { app, http: request(app.getHttpServer()), prisma: app.get(PrismaService), sender, clock };
}

/** Extracts `name=value` for a cookie from a response, ready to send back. */
export function cookieFrom(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`))?.split(';')[0];
}

/** Like {@link cookieFrom}, but fails the test when the cookie wasn't set. */
export function requireCookie(res: request.Response, name: string): string {
  const cookie = cookieFrom(res, name);
  if (!cookie) {
    throw new Error(`expected a ${name} cookie in the response`);
  }
  return cookie;
}
