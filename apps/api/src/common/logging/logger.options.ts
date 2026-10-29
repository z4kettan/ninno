import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../../config/env.schema';

/** Field names that hold credentials or personal data and must never reach logs. */
const SENSITIVE_KEYS = [
  'password',
  'otp',
  'token',
  'accessToken',
  'refreshToken',
  'authkey',
  'phone',
  'mobile',
  'altPhone',
  'aadhaar',
  'aadhaarNumber',
  'idNumber',
  'documentNumber',
  'address',
  'permanentAddress',
];

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

/** Development: one short line per request, so lines that matter (like the dev OTP) stand out. */
const devSerializers = {
  req: (req: { id?: unknown; method?: string; url?: string }) => ({
    id: req.id,
    method: req.method,
    url: req.url,
  }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
};

export function buildLoggerOptions(config: AppConfig): Params {
  const development = config.nodeEnv === 'development';
  return {
    pinoHttp: {
      level: config.logLevel,
      // Log lines written during a request carry its id, not the whole request again.
      quietReqLogger: true,
      // The request id middleware has already set req.id.
      genReqId: (req: IncomingMessage) => req.id,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      autoLogging: { ignore: (req) => req.url === '/health' },
      serializers: development ? devSerializers : undefined,
      transport: development
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          }
        : undefined,
    },
  };
}
