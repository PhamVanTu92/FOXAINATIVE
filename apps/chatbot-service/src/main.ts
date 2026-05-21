import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env['CHATBOT_SERVICE_PORT'] ?? 3004);
  await app.listen(port);
  new Logger('ChatbotService').log(`🚀 Chatbot Service chạy tại http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Lỗi khởi động:', err);
  process.exit(1);
});
