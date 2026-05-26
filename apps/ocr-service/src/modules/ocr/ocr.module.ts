import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@foxai/shared-types';
import { OcrProducerService } from './ocr-producer.service';
import { OcrProcessor } from './processors/ocr.processor';
import { MockOcrProvider } from './providers/mock-ocr.provider';
import { LocalPdfOcrProvider } from './providers/local-pdf-ocr.provider';
import { ClaudeOcrProvider } from './providers/claude-ocr.provider';
import { GeminiOcrProvider } from './providers/gemini-ocr.provider';
import { OCR_PROVIDER, IOcrProvider } from './providers/ocr.provider';

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
  providers: [
    OcrProducerService,
    OcrProcessor,
    MockOcrProvider,
    LocalPdfOcrProvider,
    ClaudeOcrProvider,
    GeminiOcrProvider,
    {
      provide: OCR_PROVIDER,
      useFactory: (
        mock: MockOcrProvider,
        localPdf: LocalPdfOcrProvider,
        claude: ClaudeOcrProvider,
        gemini: GeminiOcrProvider,
      ): IOcrProvider => {
        const name = process.env['OCR_PROVIDER'] ?? 'mock';
        let provider: IOcrProvider;
        if (name === 'gemini')         provider = gemini;
        else if (name === 'claude')    provider = claude;
        else if (name === 'local-pdf') provider = localPdf;
        else                           provider = mock;
        console.log(`[OcrModule] ✅ Provider đang dùng: ${provider.name} (OCR_PROVIDER="${name}")`);
        return provider;
      },
      inject: [MockOcrProvider, LocalPdfOcrProvider, ClaudeOcrProvider, GeminiOcrProvider],
    },
  ],
  exports: [OcrProducerService],
})
export class OcrModule {}
