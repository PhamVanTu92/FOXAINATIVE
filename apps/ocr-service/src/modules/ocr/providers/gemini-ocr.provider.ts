import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import type { OcrRequest, OcrResult, OcrExtractedField, OcrExtractedLineItem } from '@foxai/shared-types';
import { FileParserFactory } from '../file-parsers/file-parser.factory';
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

    // --- 1. Đọc file từ disk ---
    const filePath = resolveFilePath(request.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Không tìm thấy file: ${request.fileUrl}`);
    }
    const buffer = fs.readFileSync(filePath);

    // --- 2. Parse file bằng FileParserFactory (Strategy Pattern) ---
    const parser = FileParserFactory.getParser(filePath);
    const parsedFile = await parser.parse(buffer, filePath);
    this.logger.log(`🔮 Gemini OCR → document ${request.documentId} | parser: ${path.extname(filePath)} → type="${parsedFile.type}" | model: ${model}`);

    // --- 3. Xây dựng prompt ---
    const fieldsPrompt = buildFieldsPrompt(request);
    const tablesHint = buildTablesHint(request);

    const extractionInstructions = `Bạn là chuyên gia nhận dạng chứng từ kế toán Việt Nam. Hãy trích xuất thông tin từ tài liệu.

Các trường cần trích xuất:
${fieldsPrompt}

Trả về JSON thuần (không markdown, không giải thích, chỉ JSON):
{
  "fields": [
    { "fieldKey": "tên_trường", "value": "giá_trị_trích_xuất", "confidence": 0.95 }
  ],
  "lineItems": [
    { "tableKey": "tên_bảng", "stt": 1, "name": "tên hàng hóa/dịch vụ", "unit": "đvt", "quantity": 1, "unitPrice": 1000000, "amount": 1000000 }
  ]
}

Quy tắc quan trọng:
- Trường không tìm thấy → value = ""
- confidence từ 0.0 đến 1.0
- Số tiền: chỉ chữ số nguyên, KHÔNG có dấu chấm/phẩy (vd: 87000000)
- Ngày tháng: định dạng DD/MM/YYYY
- lineItems: mảng rỗng [] nếu không có bảng hàng hóa
- ${tablesHint}`;

    // --- 4. Tạo nội dung request phù hợp với từng loại file ---
    let contentParts: Part[];

    if (parsedFile.type === 'image') {
      // PDF hoặc ảnh → gửi kèm inlineData
      contentParts = [
        { inlineData: { data: parsedFile.content, mimeType: parsedFile.mimeType! } },
        { text: extractionInstructions },
      ];
    } else {
      // Excel/Word → nhúng toàn bộ text vào prompt, không cần vision
      const fullPrompt = `Dưới đây là toàn bộ nội dung tài liệu (đã được chuyển đổi sang văn bản/bảng):\n\n${parsedFile.content}\n\n---\n\n${extractionInstructions}`;
      contentParts = [{ text: fullPrompt }];
    }

    // --- 5. Gọi Gemini API ---
    const geminiModel = this.genAI.getGenerativeModel({ model });
    const geminiResult = await geminiModel.generateContent(contentParts);
    const rawText = geminiResult.response.text();
    this.logger.debug(`Gemini raw response:\n${rawText.slice(0, 400)}`);

    // --- 6. Parse JSON kết quả ---
    const jsonStr = extractJson(rawText);
    if (!jsonStr) throw new Error('Gemini không trả về JSON hợp lệ.');

    const parsed = JSON.parse(jsonStr) as {
      fields?: Array<{ fieldKey: string; value: string; confidence?: number }>;
      lineItems?: Array<{ tableKey?: string; stt?: number; name?: string; unit?: string; quantity?: number; unitPrice?: number; amount?: number }>;
    };

    const fields: OcrExtractedField[] = (parsed.fields ?? []).map(f => ({
      fieldKey: f.fieldKey,
      value: f.value ?? '',
      confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.9,
    }));

    const lineItems: OcrExtractedLineItem[] = (parsed.lineItems ?? []).map((li, i) => ({
      stt: li.stt ?? i + 1,
      tableKey: li.tableKey || undefined,
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

    return { confidence: avgConfidence, language: request.language, engineVersion: this.version, fields, lineItems };
  }
}

// ────────────────────────────── Helpers ──────────────────────────────

function resolveFilePath(fileUrl: string): string | null {
  if (fileUrl.startsWith('file:///')) return decodeURIComponent(fileUrl.slice(8));
  if (fileUrl.startsWith('file://'))  return decodeURIComponent(fileUrl.slice(7));
  if (path.isAbsolute(fileUrl))       return fileUrl;
  return null;
}

function buildFieldsPrompt(request: OcrRequest): string {
  if (request.schemaFields?.length) {
    return request.schemaFields
      .map(f => `  - ${f.fieldKey}: "${f.label}" (${f.dataType})${f.description ? ` — ${f.description}` : ''}`)
      .join('\n');
  }
  return [
    '  - invoiceNumber: "Số hóa đơn"',
    '  - issueDate: "Ngày phát hành"',
    '  - sellerName: "Tên người bán"',
    '  - sellerTaxCode: "Mã số thuế người bán"',
    '  - totalAmount: "Tổng tiền trước thuế"',
    '  - vatAmount: "Tiền thuế VAT"',
    '  - grandTotal: "Tổng thanh toán"',
  ].join('\n');
}

function buildTablesHint(request: OcrRequest): string {
  const tableKeys = [...new Set(
    (request.schemaFields ?? [])
      .map(f => (f as { tableKey?: string }).tableKey)
      .filter((k): k is string => !!k),
  )];
  return tableKeys.length
    ? `Tài liệu có các bảng: ${tableKeys.join(', ')}. Điền "tableKey" theo đúng tên bảng tương ứng.`
    : 'Nếu tài liệu có nhiều bảng, điền "tableKey" là tên bảng chứa dòng đó. Nếu chỉ có 1 bảng, bỏ qua hoặc để "".';
}

function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1]!.trim();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}
