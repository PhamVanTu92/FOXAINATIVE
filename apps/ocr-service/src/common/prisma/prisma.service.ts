import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ocrPrisma } from '@foxai/ocr-db';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly client = ocrPrisma;

  async onModuleInit() {
    await this.client.$connect();
    this.logger.log('✓ Kết nối OCR DB thành công');
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    this.logger.log('✓ Đã đóng kết nối OCR DB');
  }
}
