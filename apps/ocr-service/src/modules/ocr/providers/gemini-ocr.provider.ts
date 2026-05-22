import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import type { OcrRequest, OcrResult, OcrExtractedField, OcrExtractedLineItem } from '@foxai/shared-types';
import type { IOcrProvider } from './ocr.provider';

@Injectable()
export class GeminiOcrProvider implements IOcrProvider {
  readonly name = 'gemini-ocr';
  get version() { return process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'; }
  private readonly logger = new Logger(GeminiOcrProvider.name);
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY'] ?? 'placeholder');
  }

  async scan(request: OcrRequest): Promise<OcrResult> {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('GEMINI_API_KEY chưa được cấu hình trong .env');
    this.genAI = new GoogleGenerativeAI(apiKey);
    const model = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash';

    const filePath = resolveFilePath(request.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Không tìm thấy file: ${request.fileUrl}`);
    }

    const buffer = fs.readFileSync(filePath);
    const mimeType = request.mimeType ?? detectMimeType(filePath);
    const base64 = buffer.toString('base64');

    const fieldsPrompt = request.schemaFields?.length
      ? request.schemaFields
          .map(f => `  - ${f.fieldKey}: "${f.label}" (${f.dataType})${f.description ? ` — ${f.description}` : ''}`)
          .join('\n')
      : [
          '  - invoiceNumber: "Số hóa đơn"',
          '  - issueDate: "Ngày phát hành"',
          '  - sellerName: "Tên người bán"',
          '  - sellerTaxCode: "Mã số thuế người bán"',
          '  - totalAmount: "Tổng tiền trước thuế"',
          '  - vatAmount: "Tiền thuế VAT"',
          '  - grandTotal: "Tổng thanh toán"',
        ].join('\n');

    const prompt = `Bạn là chuyên gia nhận dạng chứng từ kế toán Việt Nam. Hãy trích xuất thông tin từ tài liệu trên.

Các trường cần trích xuất:
${fieldsPrompt}

Trả về JSON thuần (không markdown, không giải thích, chỉ JSON):
{
  "fields": [
    { "fieldKey": "tên_trường", "value": "giá_trị_trích_xuất", "confidence": 0.95 }
  ],
  "lineItems": [
    { "stt": 1, "name": "tên hàng hóa/dịch vụ", "unit": "đvt", "quantity": 1, "unitPrice": 1000000, "amount": 1000000 }
  ]
}

Quy tắc quan trọng:
- Trường không tìm thấy trong tài liệu → value = ""
- confidence từ 0.0 đến 1.0 (mức độ chắc chắn khi trích xuất)
- Số tiền: chỉ chữ số nguyên, KHÔNG có dấu chấm/phẩy phân cách (vd: 87000000)
- Ngày tháng: định dạng DD/MM/YYYY
- lineItems: danh sách hàng hóa/dịch vụ trong bảng (mảng rỗng [] nếu không có bảng)`;

    const geminiModel = this.genAI.getGenerativeModel({ model });

    this.logger.log(`🔮 Gemini OCR → document ${request.documentId} (model: ${model})`);
    const geminiResult = await geminiModel.generateContent([
      { inlineData: { data: base64, mimeType } },
      prompt,
    ]);

    const rawText = geminiResult.response.text();
    this.logger.debug(`Gemini phản hồi:\n${rawText.slice(0, 400)}`);

    const jsonStr = extractJson(rawText);
    if (!jsonStr) throw new Error('Gemini không trả về JSON hợp lệ.');

    const parsed = JSON.parse(jsonStr) as {
      fields?: Array<{ fieldKey: string; value: string; confidence?: number }>;
      lineItems?: Array<{
        stt?: number; name?: string; unit?: string;
        quantity?: number; unitPrice?: number; amount?: number;
      }>;
    };

    const fields: OcrExtractedField[] = (parsed.fields ?? []).map(f => ({
      fieldKey: f.fieldKey,
      value: f.value ?? '',
      confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.9,
    }));

    const lineItems: OcrExtractedLineItem[] = (parsed.lineItems ?? []).map((li, i) => ({
      stt: li.stt ?? i + 1,
      name: li.name ?? undefined,
      unit: li.unit ?? undefined,
      quantity: typeof li.quantity === 'number' ? li.quantity : undefined,
      unitPrice: typeof li.unitPrice === 'number' ? li.unitPrice : undefined,
      amount: typeof li.amount === 'number' ? li.amount : undefined,
    }));

    const filledFields = fields.filter(f => f.value.trim() !== '');
    const avgConfidence = filledFields.length > 0
      ? filledFields.reduce((s, f) => s + f.confidence, 0) / filledFields.length
      : 0;

    this.logger.log(
      `✅ Gemini OCR xong: ${filledFields.length}/${fields.length} trường, ` +
      `${lineItems.length} dòng hàng, độ tin cậy ${(avgConfidence * 100).toFixed(0)}%`,
    );

    return {
      confidence: avgConfidence,
      language: request.language,
      engineVersion: this.version,
      fields,
      lineItems,
    };
  }
}

function resolveFilePath(fileUrl: string): string | null {
  if (fileUrl.startsWith('file:///')) return decodeURIComponent(fileUrl.slice(8));
  if (fileUrl.startsWith('file://'))  return decodeURIComponent(fileUrl.slice(7));
  if (path.isAbsolute(fileUrl))       return fileUrl;
  return null;
}

function detectMimeType(filePath: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf', '.png': 'image/png',
    '.jpg': 'image/jpeg',      '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',       '.webp': 'image/webp',
    '.tiff': 'image/tiff',     '.tif': 'image/tiff',
  };
  return map[path.extname(filePath).toLowerCase()] ?? 'application/pdf';
}

function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1]!.trim();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}
