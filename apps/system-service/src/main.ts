import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env['SYSTEM_SERVICE_PORT'] ?? 3002);
  await app.listen(port);
  new Logger('SystemService').log(`🚀 System Service chạy tại http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Lỗi khởi động:', err);
  process.exit(1);
});
