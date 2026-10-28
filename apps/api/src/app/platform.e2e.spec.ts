import { Body, Controller, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsInt, IsString, Min } from 'class-validator';
import request from 'supertest';
import { type AppConfig, loadConfig } from '../config/env.schema';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

class ProbeDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  beds!: number;
}

/** Test-only routes that exercise the platform behaviour. */
@Controller('probe')
class ProbeController {
  @Get()
  ok() {
    return { ok: true };
  }

  @Post()
  create(@Body() dto: ProbeDto) {
    return dto;
  }

  @Get('crash')
  crash(): never {
    throw new Error('database password is hunter2');
  }
}

const baseEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  WEB_ORIGINS: 'http://localhost:4200',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
};

async function createApp(env: Record<string, string> = {}): Promise<NestExpressApplication> {
  const config: AppConfig = loadConfig({ ...baseEnv, ...env });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config)],
    controllers: [ProbeController],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app, config);
  await app.init();
  return app;
}

describe('API platform', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('versioned base path', () => {
    it('serves business routes under /api/v1', async () => {
      await request(app.getHttpServer()).get('/api/v1/probe').expect(200, { ok: true });
    });

    it('does not serve unversioned routes', async () => {
      const res = await request(app.getHttpServer()).get('/api/probe').expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('health check', () => {
    it('returns ok at /health without auth', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok', version: 'dev', uptimeSeconds: expect.any(Number) });
    });
  });

  describe('error envelope', () => {
    it('returns NOT_FOUND with a requestId matching the header', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
      expect(res.body).toEqual({
        code: 'NOT_FOUND',
        message: expect.any(String),
        details: null,
        requestId: res.headers['x-request-id'],
      });
    });

    it('hides internals of unexpected errors', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/probe/crash').expect(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
      expect(res.body).not.toHaveProperty('stack');
    });

    it('returns BAD_REQUEST for malformed JSON', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .set('content-type', 'application/json')
        .send('{"name":')
        .expect(400);
      expect(res.body.code).toBe('BAD_REQUEST');
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });
  });

  describe('input validation', () => {
    it('rejects unknown properties', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'A', beds: 2, isAdmin: true })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'isAdmin' })]),
      );
    });

    it('lists missing and mistyped fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ beds: 'two' })
        .expect(400);
      const fields = res.body.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['name', 'beds']));
    });

    it('accepts a valid body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'A', beds: 2 })
        .expect(201, { name: 'A', beds: 2 });
    });
  });

  describe('request correlation', () => {
    it('echoes a well-formed client id', async () => {
      const res = await request(app.getHttpServer()).get('/health').set('x-request-id', 'abc-123');
      expect(res.headers['x-request-id']).toBe('abc-123');
    });

    it('generates an id when none or an unsafe one is sent', async () => {
      const none = await request(app.getHttpServer()).get('/health');
      expect(none.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      const unsafe = await request(app.getHttpServer())
        .get('/health')
        .set('x-request-id', '<script>');
      expect(unsafe.headers['x-request-id']).not.toBe('<script>');
    });
  });

  describe('transport security', () => {
    it('sends security headers', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('allows the configured web origin', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/probe')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    });

    it('gives no CORS header to other origins', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/probe')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects oversized bodies with 413', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'x'.repeat(200 * 1024), beds: 1 })
        .expect(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('API documentation', () => {
    it('serves /api/docs outside production', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs').redirects(1).expect(200);
      expect(res.text).toContain('swagger');
    });
  });
});

describe('API platform in production', () => {
  it('does not serve /api/docs', async () => {
    const app = await createApp({ NODE_ENV: 'production' });
    await request(app.getHttpServer()).get('/api/docs').expect(404);
    await app.close();
  });
});

describe('rate limiting', () => {
  it('returns RATE_LIMITED once the limit is exceeded', async () => {
    const app = await createApp({ RATE_LIMIT_PER_MINUTE: '2' });
    const server = app.getHttpServer();
    await request(server).get('/api/v1/probe').expect(200);
    await request(server).get('/api/v1/probe').expect(200);
    const res = await request(server).get('/api/v1/probe').expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    await app.close();
  });
});
