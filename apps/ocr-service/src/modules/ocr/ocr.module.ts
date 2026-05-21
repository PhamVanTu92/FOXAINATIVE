import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@foxai/shared-types';
import { OcrProducerService } from './ocr-producer.service';
import { OcrProcessor } from './processors/ocr.processor';
import { MockOcrProvider } from './providers/mock-ocr.provider';
import { LocalPdfOcrProvider } from './providers/local-pdf-ocr.provider';
import { OCR_PROVIDER } from './providers/ocr.provider';

const ocrProvider = process.env['OCR_PROVIDER'] === 'local-pdf'
  ? { provide: OCR_PROVIDER, useClass: LocalPdfOcrProvider }
  : { provide: OCR_PROVIDER, useClass: MockOcrProvider };

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.OCR,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000, age: 24 * 3600 },
        removeOnFail: { count: 500 },
      },
    }),
  ],
  providers: [OcrProducerService, OcrProcessor, MockOcrProvider, LocalPdfOcrProvider, ocrProvider],
  exports: [OcrProducerService],
})
export class OcrModule {}
