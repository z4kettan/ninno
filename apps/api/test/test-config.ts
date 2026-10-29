import { type AppConfig, loadConfig } from '../src/config/env.schema';

/** A complete, valid environment for tests. Override per test as needed. */
export const TEST_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  WEB_ORIGINS: 'http://localhost:4200',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
  OTP_PEPPER: 'test-otp-pepper-0123456789abcdefghij',
} as const;

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({ ...TEST_ENV, ...overrides });
}
