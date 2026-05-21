import type { OcrRequest, OcrResult } from '@foxai/shared-types';

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');

export interface IOcrProvider {
  readonly name: string;
  readonly version: string;
  scan(request: OcrRequest): Promise<OcrResult>;
}
