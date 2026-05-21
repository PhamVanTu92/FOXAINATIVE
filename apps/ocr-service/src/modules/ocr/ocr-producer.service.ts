import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { OcrJobPayload, QUEUE_NAMES } from '@foxai/shared-types';

@Injectable()
export class OcrProducerService {
  private readonly logger = new Logger(OcrProducerService.name);

  constructor(@InjectQueue(QUEUE_NAMES.OCR) private readonly ocrQueue: Queue) {}

  async enqueue(payload: OcrJobPayload) {
    const job = await this.ocrQueue.add('scan', payload, {
      jobId: `ocr-${payload.documentId}`,
    });
    this.logger.log(`📤 Đẩy job OCR ${job.id} cho document ${payload.documentId}`);
    return job;
  }

  async getJobStatus(documentId: string) {
    const job = await this.ocrQueue.getJob(`ocr-${documentId}`);
    if (!job) return { state: 'not_found' as const };
    const state = await job.getState();
    return { state, progress: job.progress, failedReason: job.failedReason };
  }
}
