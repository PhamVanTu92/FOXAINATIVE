import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import type { OcrRequest, OcrResult, OcrExtractedField, OcrExtractedLineItem, OcrSchemaTable, OcrSchemaTableColumn } from '@foxai/shared-types';
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

    // --- 1. Đọc / nhận nội dung file ---
    let parsedFile: { type: 'image' | 'text'; content: string; mimeType?: string };
    if (request.inlineContent) {
      parsedFile = request.inlineContent;
      this.logger.log(`🔮 Gemini OCR → document ${request.documentId} | inlineContent: type="${parsedFile.type}" | model: ${model}`);
    } else {
      const filePath = resolveFilePath(request.fileUrl);
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Không tìm thấy file: ${request.fileUrl}`);
      }
      const buffer = fs.readFileSync(filePath);
      const parser = FileParserFactory.getParser(filePath);
      parsedFile = await parser.parse(buffer, filePath);
      this.logger.log(`🔮 Gemini OCR → document ${request.documentId} | parser: ${path.extname(filePath)} → type="${parsedFile.type}" | model: ${model}`);
    }

    // --- 3. Xây dựng prompt ---
    const fieldsPrompt = buildFieldsPrompt(request);
    const tablesPrompt = buildTablesPrompt(request);
    const customPromptSection = request.promptTemplate?.trim()
      ? `\nLƯU Ý ĐẶC BIỆT TỪ NGƯỜI DÙNG:\n${request.promptTemplate.trim()}\n`
      : '';

    const extractionInstructions = `Bạn là chuyên gia nhận dạng chứng từ kế toán Việt Nam. Hãy trích xuất thông tin từ tài liệu.

Các trường cần trích xuất:
${fieldsPrompt}

Trả về JSON thuần (không markdown, không giải thích, chỉ JSON):
{
  "fields": [
    { "fieldKey": "tên_trường", "value": "giá_trị_trích_xuất", "confidence": 0.95 }
  ],
  "lineItems": [
    // Bảng tiêu chuẩn (name/unit/qty/price/amount):
    { "tableKey": "...", "stt": 1, "name": "...", "unit": "...", "quantity": 1, "unitPrice": 1000000, "amount": 1000000 },
    // Bảng tùy chỉnh (cột được định nghĩa riêng → dùng extraData):
    { "tableKey": "...", "stt": 1, "extraData": { "columnKey1": "giá_trị_1", "columnKey2": "giá_trị_2" } }
  ]
}

Quy tắc quan trọng:
- Trường không tìm thấy → value = ""
- confidence từ 0.0 đến 1.0
- Số tiền: chỉ chữ số nguyên, KHÔNG có dấu chấm/phẩy (vd: 87000000)
- Ngày/giờ (DATE): giữ nguyên định dạng tìm thấy trong tài liệu — nếu có cả ngày lẫn giờ thì trả đủ (vd: "09:40 - 25/05/2026"), chỉ có ngày thì trả ngày (vd: "25/05/2026"), chỉ có giờ thì trả giờ (vd: "09:40")
- lineItems: mảng rỗng [] nếu không có bảng hàng hóa
${customPromptSection}
${tablesPrompt}`;

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
    // thinkingBudget=0: tắt chế độ "thinking" của Gemini 2.5 — không cần suy luận cho bài toán trích xuất có cấu trúc
    const geminiModel = this.genAI.getGenerativeModel({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
    });
    const t0 = Date.now();
    const geminiResult = await geminiModel.generateContent(contentParts);
    this.logger.log(`⏱️  Gemini API response: ${Date.now() - t0}ms`);
    const rawText = geminiResult.response.text();
    this.logger.debug(`Gemini raw response:\n${rawText.slice(0, 400)}`);

    // --- 6. Parse JSON kết quả ---
    const jsonStr = extractJson(rawText);
    if (!jsonStr) throw new Error('Gemini không trả về JSON hợp lệ.');

    const parsed = JSON.parse(jsonStr) as {
      fields?: Array<{ fieldKey: string; value: string; confidence?: number }>;
      lineItems?: Array<{
        tableKey?: string; stt?: number;
        name?: string; unit?: string; quantity?: number; unitPrice?: number; amount?: number;
        extraData?: Record<string, unknown>;
      }>;
    };

    const fields: OcrExtractedField[] = (parsed.fields ?? []).map(f => ({
      fieldKey: f.fieldKey,
      value: String(f.value ?? ''),
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
      extraData: li.extraData ?? undefined,
    }));

    const filledFields = fields.filter(f => String(f.value ?? '').trim() !== '');
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
  if (fileUrl.startsWith('file://')) return decodeURIComponent(fileUrl.slice(7));
  if (path.isAbsolute(fileUrl))      return fileUrl;
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

function buildTablesPrompt(request: OcrRequest): string {
  const tables = (request.schemaTables ?? []).filter((t: OcrSchemaTable) => t.columns.length > 0);

  if (tables.length === 0) {
    const tableKeys = [...new Set(
      (request.schemaFields ?? [])
        .map(f => (f as { tableKey?: string }).tableKey)
        .filter((k): k is string => !!k),
    )];
    return tableKeys.length
      ? `Tài liệu có các bảng: ${tableKeys.join(', ')}. Điền "tableKey" theo đúng tên bảng tương ứng.`
      : 'Nếu tài liệu có bảng hàng hóa, điền "tableKey" theo tên bảng và dùng format name/unit/quantity/unitPrice/amount.';
  }

  const lines = ['QUAN TRỌNG — Cấu trúc bảng trong tài liệu này:'];
  for (const table of tables) {
    const exampleEntries = table.columns.map((c: OcrSchemaTableColumn) => `"${c.columnKey}": "giá_trị"`).join(', ');
    lines.push(
      `\nBảng "${table.name}" (tableKey: "${table.tableKey}") — ${table.columns.length} cột:`,
      ...table.columns.map((c: OcrSchemaTableColumn, i: number) => `  Cột ${i + 1}: ${c.label}  →  key="${c.columnKey}" (${c.dataType})`),
      `  Ví dụ dòng: { "tableKey": "${table.tableKey}", "stt": 1, "extraData": { ${exampleEntries} } }`,
    );
  }
  lines.push('\nVới bảng TÙY CHỈNH: đặt toàn bộ giá trị vào "extraData" (key = columnKey, không dùng name/unit/quantity/unitPrice/amount).');
  return lines.join('\n');
}

function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1]!.trim();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}
