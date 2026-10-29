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

const secret = z.string().min(32, 'must be at least 32 characters');

const envSchema = z
  .object({
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
    /** Per-IP limit on the OTP request and verify endpoints. */
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),

    JWT_ACCESS_SECRET: secret,
    OTP_PEPPER: secret,
    // Defaults to `console` outside production and `apitxt` in production.
    OTP_SENDER: z.enum(['console', 'apitxt']).optional(),
    APITXT_BASE_URL: z.url().default('https://apitxt.com'),
    APITXT_AUTH_KEY: z.string().min(1).optional(),
    APITXT_CHANNEL: z.enum(['sms', 'whatsapp', 'voice']).default('sms'),
    APITXT_TEMPLATE_ID: z.string().regex(/^\d+$/, 'must be a numeric template id').optional(),
  })
  .superRefine((env, ctx) => {
    const sender = env.OTP_SENDER ?? (env.NODE_ENV === 'production' ? 'apitxt' : 'console');
    if (env.NODE_ENV === 'production' && sender === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_SENDER'],
        message: 'must be apitxt in production',
      });
    }
    if (sender === 'apitxt' && !env.APITXT_AUTH_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['APITXT_AUTH_KEY'],
        message: 'is required when OTP_SENDER is apitxt',
      });
    }
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
  authRateLimitPerMinute: number;
  databaseUrl: string;
  auth: {
    jwtAccessSecret: string;
    otpPepper: string;
    /** Refresh cookie is Secure everywhere except local development (plain http). */
    cookieSecure: boolean;
  };
  otp: {
    sender: 'console' | 'apitxt';
    apitxt: {
      baseUrl: string;
      authKey: string | undefined;
      channel: 'sms' | 'whatsapp' | 'voice';
      templateId: string | undefined;
    };
  };
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
  // `KEY=` in a .env file means "not set", not "set to an empty string".
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(present);
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
    authRateLimitPerMinute: e.AUTH_RATE_LIMIT_PER_MINUTE,
    databaseUrl: e.DATABASE_URL,
    auth: {
      jwtAccessSecret: e.JWT_ACCESS_SECRET,
      otpPepper: e.OTP_PEPPER,
      cookieSecure: e.NODE_ENV !== 'development',
    },
    otp: {
      sender: e.OTP_SENDER ?? (e.NODE_ENV === 'production' ? 'apitxt' : 'console'),
      apitxt: {
        baseUrl: e.APITXT_BASE_URL,
        authKey: e.APITXT_AUTH_KEY,
        channel: e.APITXT_CHANNEL,
        templateId: e.APITXT_TEMPLATE_ID,
      },
    },
  };
}
