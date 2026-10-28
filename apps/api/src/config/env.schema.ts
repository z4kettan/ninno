import { z } from 'zod';

const csvOfOrigins = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_VERSION: z.string().min(1).default('dev'),
  WEB_ORIGINS: csvOfOrigins,
  BODY_LIMIT: z
    .string()
    .regex(/^\d+(b|kb|mb)$/i, 'must look like 100kb')
    .default('100kb'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(100),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
  appVersion: string;
  webOrigins: string[];
  bodyLimit: string;
  rateLimitPerMinute: number;
  databaseUrl: string;
}

export class ConfigValidationError extends Error {
  constructor(readonly issues: { key: string; problem: string }[]) {
    super(
      `Invalid environment configuration:\n${issues
        .map(({ key, problem }) => `  - ${key}: ${problem}`)
        .join('\n')}`,
    );
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validates environment variables once at startup. Error messages name the
 * offending keys but never echo their values, which may be secrets.
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigValidationError(
      result.error.issues.map((issue) => ({
        key: issue.path.join('.') || '(root)',
        problem: issue.code === 'invalid_type' ? 'is required' : issue.message,
      })),
    );
  }
  const e = result.data;
  return {
    nodeEnv: e.NODE_ENV,
    isProduction: e.NODE_ENV === 'production',
    port: e.API_PORT,
    logLevel: e.LOG_LEVEL,
    appVersion: e.APP_VERSION,
    webOrigins: e.WEB_ORIGINS,
    bodyLimit: e.BODY_LIMIT,
    rateLimitPerMinute: e.RATE_LIMIT_PER_MINUTE,
    databaseUrl: e.DATABASE_URL,
  };
}
