import { type INestApplication, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { toErrorEnvelope } from '../common/errors/error-envelope';
import { createValidationPipe } from '../common/errors/validation';
import { REQUEST_ID_HEADER, requestIdMiddleware } from '../common/http/request-id.middleware';
import type { AppConfig } from '../config/env.schema';

/**
 * Applies every cross-cutting HTTP concern. Shared by `main.ts` and the e2e
 * tests so both exercise exactly the same stack. The app must be created
 * with `bodyParser: false`.
 */
export function configureApp(app: NestExpressApplication, config: AppConfig): INestApplication {
  app.useLogger(app.get(Logger));

  // Runs before body parsing so even a rejected body gets a request id.
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: config.webOrigins,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));
  // Reads the httpOnly refresh-token cookie on /api/v1/auth routes.
  app.use(cookieParser());
  // Body-parser errors happen outside Nest, so they need the same envelope here.
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(error);
    }
    const { status, body } = toErrorEnvelope(error, String(req.id));
    res.status(status).json(body);
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Ninno API')
        .setDescription('Hostel management API')
        .setVersion(config.appVersion)
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  return app;
}
