import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  // Serve uploaded files publicly at /uploads/*
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const allowedOrigins = process.env['CORS_ORIGIN']?.split(',').map(s => s.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(process.env['API_GATEWAY_PORT'] ?? 3001);
  await app.listen(port);

  const logger = new Logger('ApiGateway');
  logger.log(`API Gateway running at http://localhost:${port}`);
  logger.log(`System Service gRPC: ${process.env['SYSTEM_SERVICE_GRPC_URL'] ?? 'localhost:51051'}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API Gateway:', err);
  process.exit(1);
});
