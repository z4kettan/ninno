import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { ConfigValidationError, loadConfig } from './config/env.schema';

async function bootstrap() {
  if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    bufferLogs: true,
    bodyParser: false,
  });
  configureApp(app, config);
  await app.listen(config.port);

  // Set when Nx waits for this server to be ready.
  if (process.env['NX_READY_SIGNAL_SOCKET']) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }
}

bootstrap();
