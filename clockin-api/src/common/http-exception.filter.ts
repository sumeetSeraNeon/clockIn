import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Standard error envelope for all HTTP failures.
 * Never leaks stack traces or raw Prisma internals to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = HttpStatus[statusCode] ?? error;
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        if (typeof obj.message === 'string' || Array.isArray(obj.message)) {
          message = obj.message as string | string[];
        }
        if (typeof obj.error === 'string') {
          error = obj.error;
        } else {
          error = HttpStatus[statusCode] ?? 'Error';
        }
      }
    } else {
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
