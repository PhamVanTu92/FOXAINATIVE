import { Module } from '@nestjs/common';
import { OcrProxyController } from './ocr-proxy.controller';
import { OcrProxyService } from './ocr-proxy.service';

@Module({
  controllers: [OcrProxyController],
  providers: [OcrProxyService],
})
export class OcrModule {}
