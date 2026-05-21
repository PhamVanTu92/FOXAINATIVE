import { Injectable, Logger } from '@nestjs/common';
import type { OcrRequest, OcrResult } from '@foxai/shared-types';
import type { IOcrProvider } from './ocr.provider';

@Injectable()
export class MockOcrProvider implements IOcrProvider {
  readonly name = 'mock-ocr';
  readonly version = 'mock-v0.2';
  private readonly logger = new Logger(MockOcrProvider.name);

  async scan(request: OcrRequest): Promise<OcrResult> {
    this.logger.log(`🎭 Mock OCR đang quét document ${request.documentId}...`);
    await new Promise((r) => setTimeout(r, 1500));

    return {
      confidence: 0.94,
      language: request.language,
      engineVersion: this.version,
      fields: [
        { fieldKey: 'invoiceNumber', value: '0000123', confidence: 0.98, bbox: { x: 0.72, y: 0.06, width: 0.18, height: 0.025, page: 1 } },
        { fieldKey: 'issueDate', value: '20/05/2026', confidence: 0.96, bbox: { x: 0.12, y: 0.31, width: 0.25, height: 0.025, page: 1 } },
        { fieldKey: 'sellerTaxCode', value: '0312345678', confidence: 0.99, bbox: { x: 0.12, y: 0.18, width: 0.2, height: 0.025, page: 1 } },
        { fieldKey: 'sellerName', value: 'CÔNG TY TNHH ABC TRADING', confidence: 0.95, bbox: { x: 0.12, y: 0.13, width: 0.55, height: 0.025, page: 1 } },
        { fieldKey: 'totalAmount', value: '87000000', confidence: 0.97, bbox: { x: 0.62, y: 0.73, width: 0.28, height: 0.025, page: 1 } },
        { fieldKey: 'vatAmount', value: '8700000', confidence: 0.96, bbox: { x: 0.62, y: 0.77, width: 0.28, height: 0.025, page: 1 } },
        { fieldKey: 'grandTotal', value: '95700000', confidence: 0.98, bbox: { x: 0.62, y: 0.81, width: 0.28, height: 0.025, page: 1 } },
      ],
      lineItems: [
        { stt: 1, name: 'Dịch vụ tư vấn thiết kế hệ thống ERP', unit: 'Giờ', quantity: 80, unitPrice: 500_000, amount: 40_000_000 },
        { stt: 2, name: 'Bản quyền phần mềm ERP Module', unit: 'Bản', quantity: 1, unitPrice: 20_000_000, amount: 20_000_000 },
        { stt: 3, name: 'Dịch vụ triển khai và đào tạo', unit: 'Lần', quantity: 1, unitPrice: 15_000_000, amount: 15_000_000 },
        { stt: 4, name: 'Hỗ trợ kỹ thuật 12 tháng', unit: 'Gói', quantity: 1, unitPrice: 12_000_000, amount: 12_000_000 },
      ],
    };
  }
}
