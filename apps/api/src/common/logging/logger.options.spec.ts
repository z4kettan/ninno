import { Writable } from 'node:stream';
import pino from 'pino';
import { testConfig } from '../../../test/test-config';
import { buildLoggerOptions, REDACT_PATHS } from './logger.options';

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { logger, lines };
}

describe('log redaction', () => {
  it('masks credentials and personal data at any common depth', () => {
    const { logger, lines } = captureLogger();
    logger.info(
      {
        password: 'hunter2',
        body: { phone: '+919876543210', otp: '123456' },
        resident: { details: { aadhaarNumber: '123412341234' } },
        req: { headers: { authorization: 'Bearer abc', cookie: 'rt=xyz' } },
      },
      'request',
    );
    const out = lines.join('');
    for (const secret of [
      'hunter2',
      '+919876543210',
      '123456',
      '123412341234',
      'Bearer abc',
      'rt=xyz',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[REDACTED]');
  });

  it('keeps non-sensitive fields', () => {
    const { logger, lines } = captureLogger();
    logger.info({ hostelId: 'h1', status: 'ACTIVE' }, 'ok');
    expect(lines.join('')).toContain('"hostelId":"h1"');
  });
});

describe('buildLoggerOptions', () => {
  const request = {
    id: 'r1',
    method: 'POST',
    url: '/api/v1/auth/otp',
    headers: { 'user-agent': 'Chrome', cookie: 'ninno_rt=secret' },
  };

  it('logs one short line per request in development, without headers', () => {
    const options = buildLoggerOptions(testConfig({ NODE_ENV: 'development' }));
    const http = options.pinoHttp as {
      quietReqLogger?: boolean;
      serializers?: { req(r: unknown): unknown };
    };
    expect(http.quietReqLogger).toBe(true);
    expect(http.serializers?.req(request)).toEqual({
      id: 'r1',
      method: 'POST',
      url: '/api/v1/auth/otp',
    });
  });

  it('keeps the full structured request in production (redaction still applies)', () => {
    const options = buildLoggerOptions(
      testConfig({ NODE_ENV: 'production', APITXT_AUTH_KEY: 'k' }),
    );
    const http = options.pinoHttp as { serializers?: unknown; transport?: unknown };
    expect(http.serializers).toBeUndefined();
    expect(http.transport).toBeUndefined();
  });
});
