import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { configValidationSchema } from './common/config/config.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { SchemaModule } from './modules/schema/schema.module';
import { DocumentModule } from './modules/document/document.module';
import { OcrModule } from './modules/ocr/ocr.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: configValidationSchema,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: Number(process.env['REDIS_PORT'] ?? 6379),
        password: process.env['REDIS_PASSWORD'] || undefined,
      },
      prefix: process.env['BULLMQ_PREFIX'] ?? 'foxai',
    }),
    PrismaModule,
    HealthModule,
    SchemaModule,
    DocumentModule,
    OcrModule,
  ],
})
export class AppModule {}
