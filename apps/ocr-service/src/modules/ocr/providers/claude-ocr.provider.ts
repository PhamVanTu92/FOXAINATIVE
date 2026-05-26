import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { OcrRequest, OcrResult, OcrExtractedField, OcrExtractedLineItem, OcrSchemaTable, OcrSchemaTableColumn } from '@foxai/shared-types';
import { FileParserFactory } from '../file-parsers/file-parser.factory';
import type { IOcrProvider } from './ocr.provider';

type ClaudeImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const CLAUDE_IMAGE_MIMES = new Set<string>(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

@Injectable()
export class ClaudeOcrProvider implements IOcrProvider {
  readonly name = 'claude-ocr';
  readonly version = 'claude-sonnet-4-5';
  private readonly logger = new Logger(ClaudeOcrProvider.name);
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] ?? 'placeholder' });
  }

  async scan(request: OcrRequest): Promise<OcrResult> {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY chưa được cấu hình trong .env');
    this.client = new Anthropic({ apiKey });
    this.logger.log(`🤖 Claude OCR → document ${request.documentId}`);

    // --- 1. Đọc / nhận nội dung file ---
    let parsedFile: { type: 'image' | 'text'; content: string; mimeType?: string };
    if (request.inlineContent) {
      parsedFile = request.inlineContent;
      this.logger.log(`📦 inlineContent: type="${parsedFile.type}" mimeType="${parsedFile.mimeType ?? ''}"`);
    } else {
      const filePath = resolveFilePath(request.fileUrl);
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Không tìm thấy file: ${request.fileUrl}`);
      }
      const buffer = fs.readFileSync(filePath);
      const parser = FileParserFactory.getParser(filePath);
      parsedFile = await parser.parse(buffer, filePath);
      this.logger.log(`📦 Parser: ${path.extname(filePath)} → type="${parsedFile.type}"`);
    }

    // --- 2. Xây dựng prompt ---
    const fieldsPrompt = buildFieldsPrompt(request);
    const tablesPrompt = buildTablesPrompt(request);
    const customPromptSection = request.promptTemplate?.trim()
      ? `\nLƯU Ý ĐẶC BIỆT TỪ NGƯỜI DÙNG:\n${request.promptTemplate.trim()}\n`
      : '';
    const systemPrompt = `Bạn là chuyên gia nhận dạng chứng từ kế toán Việt Nam. Nhiệm vụ của bạn là trích xuất thông tin từ tài liệu và trả về JSON chính xác.`;

    const extractionInstructions = `Hãy trích xuất thông tin từ tài liệu này theo các trường sau:

${fieldsPrompt}

Trả về JSON theo đúng định dạng (không kèm markdown, không text ngoài JSON):
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

Quy tắc:
- Trường không tìm thấy → value là ""
- confidence: 0.0–1.0 (mức độ chắc chắn)
- Số tiền: chỉ chữ số, không dấu chấm/phẩy phân cách (vd: 87000000)
- Ngày/giờ (DATE): giữ nguyên định dạng tìm thấy trong tài liệu — nếu có cả ngày lẫn giờ thì trả đủ (vd: "09:40 - 25/05/2026"), chỉ có ngày thì trả ngày (vd: "25/05/2026"), chỉ có giờ thì trả giờ (vd: "09:40")
- lineItems: danh sách hàng hóa/dữ liệu bảng (mảng rỗng nếu không có bảng)
${customPromptSection}
${tablesPrompt}`;

    // --- 3. Tạo nội dung message phù hợp với loại file ---
    let messageContent: Anthropic.Messages.ContentBlockParam[];
    if (parsedFile.type === 'image') {
      const fileBlock: Anthropic.Messages.DocumentBlockParam | Anthropic.Messages.ImageBlockParam =
        parsedFile.mimeType === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: parsedFile.content } }
          : {
              type: 'image',
              source: {
                type: 'base64',
                media_type: (CLAUDE_IMAGE_MIMES.has(parsedFile.mimeType ?? '') ? parsedFile.mimeType : 'image/jpeg') as ClaudeImageMimeType,
                data: parsedFile.content,
              },
            };
      messageContent = [fileBlock, { type: 'text', text: extractionInstructions }];
    } else {
      const fullPrompt = `Dưới đây là toàn bộ nội dung tài liệu:\n\n${parsedFile.content}\n\n---\n\n${extractionInstructions}`;
      messageContent = [{ type: 'text', text: fullPrompt }];
    }

    // --- 4. Gọi Claude API ---
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    });

    const rawText = response.content.find(b => b.type === 'text')
      ? (response.content.find(b => b.type === 'text') as { type: 'text'; text: string }).text
      : '';

    this.logger.debug(`Claude raw response: ${rawText.slice(0, 300)}`);

    // --- 5. Parse JSON kết quả ---
    const jsonStr = extractJson(rawText);
    if (!jsonStr) throw new Error('Claude không trả về JSON hợp lệ.');

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
      extraData: li.extraData ?? undefined,
    }));

    const filledFields = fields.filter(f => f.value.trim() !== '');
    const avgConfidence = filledFields.length > 0
      ? filledFields.reduce((s, f) => s + f.confidence, 0) / filledFields.length
      : 0;

    this.logger.log(`✅ Claude OCR xong: ${filledFields.length}/${fields.length} trường, ${lineItems.length} dòng hàng, confidence ${(avgConfidence * 100).toFixed(0)}%`);

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
    '  - sellerTaxCode: "Mã số thuế"',
    '  - totalAmount: "Tổng tiền trước thuế"',
    '  - vatAmount: "Thuế VAT"',
    '  - grandTotal: "Tổng thanh toán"',
  ].join('\n');
}

/**
 * Sinh hướng dẫn bảng cho AI.
 * - Nếu schema có định nghĩa cột tùy chỉnh → hướng dẫn AI dùng extraData
 * - Nếu không có → dùng cách cũ (name/unit/quantity/unitPrice/amount)
 */
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
