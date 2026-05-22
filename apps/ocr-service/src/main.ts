import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('OCR Service API')
    .setDescription('Backend xử lý đường ống OCR')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  app.enableShutdownHooks();

  const port = Number(process.env['OCR_SERVICE_PORT'] ?? 3003);
  await app.listen(port);
  new Logger('OcrService').log(`🚀 OCR Service chạy tại http://localhost:${port}`);
  new Logger('OcrService').log(`📖 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('❌ Lỗi khởi động OCR Service:', err);
  process.exit(1);
});
