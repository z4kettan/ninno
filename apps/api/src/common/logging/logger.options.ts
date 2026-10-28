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

export function buildLoggerOptions(config: AppConfig): Params {
  return {
    pinoHttp: {
      level: config.logLevel,
      // The request id middleware has already set req.id.
      genReqId: (req: IncomingMessage) => req.id,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      autoLogging: { ignore: (req) => req.url === '/health' },
      transport: config.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  };
}
