import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { OcrRequest, OcrResult, OcrExtractedField, OcrExtractedLineItem } from '@foxai/shared-types';
import { FileParserFactory } from '../file-parsers/file-parser.factory';
import type { IOcrProvider } from './ocr.provider';

// Tập hợp MIME type Claude chấp nhận qua image block (không phải document block)
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

    // --- 1. Đọc file từ disk ---
    const filePath = resolveFilePath(request.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Không tìm thấy file: ${request.fileUrl}`);
    }
    const buffer = fs.readFileSync(filePath);

    // --- 2. Parse file bằng FileParserFactory (Strategy Pattern) ---
    const parser = FileParserFactory.getParser(filePath);
    const parsedFile = await parser.parse(buffer, filePath);
    this.logger.log(`📦 Parser: ${path.extname(filePath)} → type="${parsedFile.type}"`);

    // --- 3. Xây dựng prompt ---
    const fieldsPrompt = buildFieldsPrompt(request);
    const tablesHint = buildTablesHint(request);
    const systemPrompt = `Bạn là chuyên gia nhận dạng chứng từ kế toán Việt Nam. Nhiệm vụ của bạn là trích xuất thông tin từ tài liệu và trả về JSON chính xác.`;

    const extractionInstructions = `Hãy trích xuất thông tin từ tài liệu này theo các trường sau:

${fieldsPrompt}

Trả về JSON theo đúng định dạng (không kèm markdown, không text ngoài JSON):
{
  "fields": [
    { "fieldKey": "tên_trường", "value": "giá_trị_trích_xuất", "confidence": 0.95 }
  ],
  "lineItems": [
    { "tableKey": "tên_bảng", "stt": 1, "name": "tên hàng hóa/dịch vụ", "unit": "đvt", "quantity": 1, "unitPrice": 1000000, "amount": 1000000 }
  ]
}

Quy tắc:
- Trường không tìm thấy → value là ""
- confidence: 0.0–1.0 (mức độ chắc chắn)
- Số tiền: chỉ chữ số, không dấu chấm/phẩy phân cách (vd: 87000000)
- Ngày: định dạng DD/MM/YYYY
- lineItems: danh sách hàng hóa trong bảng (nếu có, nếu không có thì mảng rỗng)
- ${tablesHint}`;

    // --- 4. Tạo nội dung message phù hợp với từng loại file ---
    let messageContent: Anthropic.Messages.ContentBlockParam[];

    if (parsedFile.type === 'image') {
      // PDF → document block; Ảnh → image block
      const fileBlock: Anthropic.Messages.DocumentBlockParam | Anthropic.Messages.ImageBlockParam =
        parsedFile.mimeType === 'application/pdf'
          ? {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: parsedFile.content },
            }
          : {
              type: 'image',
              source: {
                type: 'base64',
                media_type: (CLAUDE_IMAGE_MIMES.has(parsedFile.mimeType ?? '')
                  ? parsedFile.mimeType
                  : 'image/jpeg') as ClaudeImageMimeType,
                data: parsedFile.content,
              },
            };

      messageContent = [
        fileBlock,
        { type: 'text', text: extractionInstructions },
      ];
    } else {
      // Excel/Word → nhúng nội dung vào text prompt, không có vision block
      const fullPrompt = `Dưới đây là toàn bộ nội dung tài liệu (đã được chuyển đổi sang văn bản/bảng):\n\n${parsedFile.content}\n\n---\n\n${extractionInstructions}`;
      messageContent = [{ type: 'text', text: fullPrompt }];
    }

    // --- 5. Gọi Claude API ---
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

    // --- 6. Parse JSON kết quả ---
    const jsonStr = extractJson(rawText);
    if (!jsonStr) throw new Error('Claude không trả về JSON hợp lệ.');

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

function buildTablesHint(request: OcrRequest): string {
  const tableKeys = [...new Set(
    (request.schemaFields ?? [])
      .map(f => (f as { tableKey?: string }).tableKey)
      .filter((k): k is string => !!k),
  )];
  return tableKeys.length
    ? `Tài liệu có các bảng: ${tableKeys.join(', ')}. Điền "tableKey" theo đúng tên bảng tương ứng.`
    : 'Nếu tài liệu có nhiều bảng khác nhau, điền "tableKey" là tên bảng chứa dòng đó. Nếu chỉ có 1 bảng, bỏ qua hoặc để "".';
}

function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1]!.trim();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}
