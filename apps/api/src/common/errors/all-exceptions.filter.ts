import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toErrorEnvelope } from './error-envelope';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const { status, body } = toErrorEnvelope(exception, String(req.id ?? ''));

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }
    res.status(status).json(body);
  }
}
