import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import type { OcrRequest, OcrResult, OcrExtractedField, OcrExtractedLineItem } from '@foxai/shared-types';
import type { IOcrProvider } from './ocr.provider';

@Injectable()
export class LocalPdfOcrProvider implements IOcrProvider {
  readonly name = 'local-pdf-ocr';
  readonly version = '1.0.0';
  private readonly logger = new Logger(LocalPdfOcrProvider.name);

  async scan(request: OcrRequest): Promise<OcrResult> {
    this.logger.log(`📄 OCR thật cho document ${request.documentId}`);
    const filePath = resolveFilePath(request.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) throw new Error(`Không tìm thấy file: ${request.fileUrl}`);

    const buffer = fs.readFileSync(filePath);
    const rawText = await extractTextFromPdf(buffer);
    const fields = extractFields(rawText);
    const lineItems = extractLineItems(rawText);
    const confidence = fields.length > 0 ? fields.filter((f) => f.value).length / fields.length : 0;

    this.logger.log(`✅ OCR xong: ${fields.filter((f) => f.value).length}/${fields.length} trường, ${lineItems.length} dòng hàng`);
    return { confidence, language: request.language, engineVersion: this.version, fields, lineItems };
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js') as typeof import('pdfjs-dist/legacy/build/pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += (content.items as Array<{ str: string }>).map((it) => it.str).join(' ') + '\n';
  }
  return text;
}

function resolveFilePath(fileUrl: string): string | null {
  if (fileUrl.startsWith('file://')) return decodeURIComponent(fileUrl.slice(7));
  if (path.isAbsolute(fileUrl))      return fileUrl;
  return null;
}

const PATTERNS: Record<string, RegExp[]> = {
  invoiceNumber: [/\bSố:\s*([\d]+)/, /(?:Số hóa đơn|Invoice No)[:\s]+([\w\-]+)/i],
  issueDate: [/Ngày phát hành:\s+([\d]{1,2}\/[\d]{1,2}\/[\d]{4})/, /Ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/],
  sellerTaxCode: [/Mã số thuế:\s+([\d\-]{10,13})/, /MST[:\s]+([\d\-]{10,13})/i],
  sellerName: [/ĐƠN VỊ BÁN HÀNG:\s+(.+?)\s{2,}/, /Tên đơn vị bán[:\s]+(.+?)\s{2,}/i],
  totalAmount: [/Cộng tiền hàng:\s+([\d.,\s]+?)(?:\s*đ|\s{2,}|$)/, /Tổng tiền hàng[:\s]+([\d.,\s]+?)(?:\s*đ|\s{2,}|$)/i],
  vatAmount: [/Thuế GTGT[^:]*:\s+([\d.,\s]+?)(?:\s*đ|\s{2,}|$)/, /Tiền thuế[:\s]+([\d.,\s]+?)(?:\s*đ|\s{2,}|$)/i],
  grandTotal: [/TỔNG THANH TOÁN:\s+([\d.,\s]+?)(?:\s*đ|\s{2,}|$)/, /Tổng cộng thanh toán[:\s]+([\d.,\s]+?)(?:\s*đ|\s{2,}|$)/i],
};

function extractFields(text: string): OcrExtractedField[] {
  return Object.entries(PATTERNS).map(([fieldKey, patterns]) => {
    for (const re of patterns) {
      const m = re.exec(text);
      if (!m) continue;
      if (fieldKey === 'issueDate' && m[2]) return { fieldKey, value: `${(m[1] ?? '').padStart(2, '0')}/${(m[2] ?? '').padStart(2, '0')}/${m[3] ?? ''}`, confidence: 0.93 };
      const raw = (m[1] ?? '').trim();
      const value = fieldKey.includes('Amount') || fieldKey === 'grandTotal' ? cleanNumber(raw) : raw;
      if (value) return { fieldKey, value, confidence: 0.92 };
    }
    return { fieldKey, value: '', confidence: 0 };
  });
}

function extractLineItems(text: string): OcrExtractedLineItem[] {
  const tableStart = /STT\s+Tên hàng hóa/i.exec(text);
  const tableEnd = /Cộng tiền hàng|TỔNG THANH TOÁN/i.exec(text);
  if (!tableStart) return [];
  const tableText = text.slice(tableStart.index + tableStart[0].length, tableEnd ? tableEnd.index : undefined);
  const rowRe = /(\d+)\s{2,}(.+?)\s{2,}(\S+)\s{2,}([\d.,]+)\s{2,}([\d.,]+)\s{2,}([\d.,]+)/g;
  const items: OcrExtractedLineItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(tableText)) !== null) {
    items.push({ stt: parseInt(m[1] ?? '0', 10), name: (m[2] ?? '').trim(), unit: (m[3] ?? '').trim(), quantity: parseViNumber(m[4] ?? '0'), unitPrice: parseViNumber(m[5] ?? '0'), amount: parseViNumber(m[6] ?? '0') });
  }
  return items;
}

function cleanNumber(raw: string): string { return raw.trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''); }
function parseViNumber(s: string): number { return parseFloat(cleanNumber(s)) || 0; }
