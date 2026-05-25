import * as mammoth from 'mammoth';
import type { IFileParser, ParsedFile } from './file-parser.interface';

/**
 * Đọc file Word (.docx) và chuyển thành chuỗi văn bản thuần.
 *
 * Thư viện: `mammoth` – chuyên đọc DOCX, giữ nguyên cấu trúc đoạn văn,
 * tiêu đề, danh sách. Không hỗ trợ .doc (format cũ của Word 97-2003).
 *
 * extractRawText được ưu tiên thay vì convertToHtml vì:
 * - Không cần thêm bước strip HTML
 * - AI đọc plain text cũng tốt không kém HTML
 * - Tránh inject HTML entities vào prompt
 */
export class WordParser implements IFileParser {
  private static readonly SUPPORTED = new Set(['.docx']);

  validate(fileExtension: string): boolean {
    return WordParser.SUPPORTED.has(fileExtension.toLowerCase());
  }

  async parse(fileBuffer: Buffer): Promise<ParsedFile> {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });

    // mammoth có thể trả về warnings (ví dụ: style không nhận ra)
    // Chúng ta bỏ qua warning, chỉ lấy text
    const text = result.value.trim() || '(File Word không có nội dung văn bản)';

    return {
      type: 'text',
      content: text,
    };
  }
}
