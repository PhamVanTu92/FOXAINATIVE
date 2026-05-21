import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.enableCors({
    origin: process.env['CORS_ORIGIN']?.split(',') ?? true,
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
