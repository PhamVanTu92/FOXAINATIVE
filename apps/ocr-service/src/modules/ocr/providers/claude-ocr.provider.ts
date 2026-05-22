import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { OcrRequest, OcrResult, OcrExtractedField, OcrExtractedLineItem } from '@foxai/shared-types';
import type { IOcrProvider } from './ocr.provider';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const IMAGE_TYPES = new Set<string>(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

@Injectable()
export class ClaudeOcrProvider implements IOcrProvider {
  readonly name = 'claude-ocr';
  readonly version = 'claude-sonnet-4-5';
  private readonly logger = new Logger(ClaudeOcrProvider.name);
  private client: Anthropic;

  constructor() {
    const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
    this.client = new Anthropic({ apiKey: apiKey || 'placeholder' });
  }

  async scan(request: OcrRequest): Promise<OcrResult> {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY chưa được cấu hình trong .env');
    this.client = new Anthropic({ apiKey });
    this.logger.log(`🤖 Claude OCR → document ${request.documentId}`);

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
      : '  - invoiceNumber: "Số hóa đơn"\n  - issueDate: "Ngày phát hành"\n  - sellerName: "Tên người bán"\n  - sellerTaxCode: "Mã số thuế"\n  - totalAmount: "Tổng tiền trước thuế"\n  - vatAmount: "Thuế VAT"\n  - grandTotal: "Tổng thanh toán"';

    const systemPrompt = `Bạn là chuyên gia nhận dạng chứng từ kế toán Việt Nam. Nhiệm vụ của bạn là trích xuất thông tin từ tài liệu và trả về JSON chính xác.`;

    const userPrompt = `Hãy trích xuất thông tin từ tài liệu này theo các trường sau:

${fieldsPrompt}

Trả về JSON theo đúng định dạng (không kèm markdown, không text ngoài JSON):
{
  "fields": [
    { "fieldKey": "tên_trường", "value": "giá_trị_trích_xuất", "confidence": 0.95 }
  ],
  "lineItems": [
    { "stt": 1, "name": "tên hàng hóa/dịch vụ", "unit": "đvt", "quantity": 1, "unitPrice": 1000000, "amount": 1000000 }
  ]
}

Quy tắc:
- Trường không tìm thấy → value là ""
- confidence: 0.0–1.0 (mức độ chắc chắn)
- Số tiền: chỉ chữ số, không dấu chấm/phẩy phân cách (vd: 87000000)
- Ngày: định dạng DD/MM/YYYY
- lineItems: danh sách hàng hóa trong bảng (nếu có, nếu không có thì mảng rỗng)`;

    const fileBlock: Anthropic.Messages.ImageBlockParam | Anthropic.Messages.DocumentBlockParam =
      IMAGE_TYPES.has(mimeType)
        ? { type: 'image', source: { type: 'base64', media_type: mimeType as ImageMediaType, data: base64 } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };

    const textBlock: Anthropic.TextBlockParam = { type: 'text', text: userPrompt };

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [fileBlock, textBlock],
      }],
    });

    const rawText = response.content.find(b => b.type === 'text')
      ? (response.content.find(b => b.type === 'text') as { type: 'text'; text: string }).text
      : '';

    this.logger.debug(`Claude raw response: ${rawText.slice(0, 300)}`);

    const jsonStr = extractJson(rawText);
    if (!jsonStr) throw new Error('Claude không trả về JSON hợp lệ.');

    const parsed = JSON.parse(jsonStr) as {
      fields?: Array<{ fieldKey: string; value: string; confidence?: number }>;
      lineItems?: Array<{ stt?: number; name?: string; unit?: string; quantity?: number; unitPrice?: number; amount?: number }>;
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

    this.logger.log(`✅ Claude OCR xong: ${filledFields.length}/${fields.length} trường, ${lineItems.length} dòng hàng, confidence ${(avgConfidence * 100).toFixed(0)}%`);

    return { confidence: avgConfidence, language: request.language, engineVersion: this.version, fields, lineItems };
  }
}

function resolveFilePath(fileUrl: string): string | null {
  if (fileUrl.startsWith('file:///')) return decodeURIComponent(fileUrl.slice(8));
  if (fileUrl.startsWith('file://')) return decodeURIComponent(fileUrl.slice(7));
  if (path.isAbsolute(fileUrl)) return fileUrl;
  return null;
}

function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.pdf': 'application/pdf', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp',
  };
  return map[ext] ?? 'application/pdf';
}

function extractJson(text: string): string | null {
  // Try to find JSON block from markdown code fences first
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1]!.trim();
  // Otherwise find the outermost { } block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}
