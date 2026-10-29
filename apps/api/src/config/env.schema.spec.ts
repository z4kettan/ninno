import { ConfigValidationError, loadConfig } from './env.schema';

const valid = {
  WEB_ORIGINS: 'http://localhost:4200, https://app.ninno.in',
  DATABASE_URL: 'postgresql://ninno:s3cret-pass@localhost:5432/ninno',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  OTP_PEPPER: 'b'.repeat(32),
};

const production = { ...valid, NODE_ENV: 'production' };

describe('loadConfig', () => {
  it('parses a valid environment with defaults', () => {
    const config = loadConfig(valid);
    expect(config).toMatchObject({
      nodeEnv: 'development',
      isProduction: false,
      port: 3000,
      webOrigins: ['http://localhost:4200', 'https://app.ninno.in'],
      bodyLimit: '100kb',
      rateLimitPerMinute: 100,
      auth: { cookieSecure: false },
      otp: { sender: 'console', apitxt: { channel: 'sms', baseUrl: 'https://apitxt.com' } },
    });
  });

  it('names a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...env } = valid;
    expect(() => loadConfig(env)).toThrow(ConfigValidationError);
    expect(() => loadConfig(env)).toThrow(/DATABASE_URL: is required/);
  });

  it('never echoes secret values', () => {
    const env = { ...valid, DATABASE_URL: 'mysql://root:topsecret@db/x', API_PORT: 'abc' };
    try {
      loadConfig(env);
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('API_PORT');
      expect(message).not.toContain('topsecret');
    }
  });

  it('rejects short secrets without echoing them', () => {
    expect(() => loadConfig({ ...valid, OTP_PEPPER: 'short-pepper' })).toThrow(
      /OTP_PEPPER: must be at least 32 characters/,
    );
    expect(() => loadConfig({ ...valid, OTP_PEPPER: 'short-pepper' })).not.toThrow(/short-pepper/);
  });

  it('treats empty values as unset', () => {
    const config = loadConfig({ ...valid, APITXT_AUTH_KEY: '', APITXT_TEMPLATE_ID: '' });
    expect(config.otp.apitxt.authKey).toBeUndefined();
    expect(config.otp.apitxt.templateId).toBeUndefined();
  });

  describe('OTP sender', () => {
    it('refuses the console sender in production', () => {
      expect(() =>
        loadConfig({ ...production, OTP_SENDER: 'console', APITXT_AUTH_KEY: 'k' }),
      ).toThrow(/OTP_SENDER: must be apitxt in production/);
    });

    it('defaults to apitxt in production and then requires a key', () => {
      expect(() => loadConfig(production)).toThrow(/APITXT_AUTH_KEY: is required/);
    });

    it('accepts apitxt with a key in production', () => {
      const config = loadConfig({
        ...production,
        APITXT_AUTH_KEY: 'live-key',
        APITXT_TEMPLATE_ID: '42',
      });
      expect(config.otp).toMatchObject({
        sender: 'apitxt',
        apitxt: { authKey: 'live-key', templateId: '42' },
      });
      expect(config.auth.cookieSecure).toBe(true);
    });

    it('requires a key whenever apitxt is chosen explicitly', () => {
      expect(() => loadConfig({ ...valid, OTP_SENDER: 'apitxt' })).toThrow(/APITXT_AUTH_KEY/);
    });
  });
});
