import { ConfigValidationError, loadConfig } from './env.schema';

const valid = {
  WEB_ORIGINS: 'http://localhost:4200, https://app.ninno.in',
  DATABASE_URL: 'postgresql://ninno:s3cret-pass@localhost:5432/ninno',
};

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
});
