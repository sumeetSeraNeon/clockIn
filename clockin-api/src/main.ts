import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://127.0.0.1:3001'
  )
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: frontendOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const rawPort = process.env.PORT;
  const port =
    rawPort && String(rawPort).trim() !== ''
      ? Number(rawPort)
      : 3000;
  if (!Number.isFinite(port) || port < 0 || port >= 65536) {
    throw new Error(`Invalid PORT: ${JSON.stringify(rawPort)}`);
  }
  await app.listen(port);
}
bootstrap();
