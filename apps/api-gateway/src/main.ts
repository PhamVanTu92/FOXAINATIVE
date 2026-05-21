import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env['API_GATEWAY_PORT'] ?? 3001);
  await app.listen(port);
  new Logger('ApiGateway').log(`🚀 API Gateway chạy tại http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Lỗi khởi động:', err);
  process.exit(1);
});
