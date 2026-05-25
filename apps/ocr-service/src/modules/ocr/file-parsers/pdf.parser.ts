import type { IFileParser, ParsedFile } from './file-parser.interface';

/**
 * Chuyển file PDF thành base64 để gửi cho Vision AI dưới dạng document block.
 * PDF được AI đọc trực tiếp (không cần extract text trước) → độ chính xác cao hơn.
 */
export class PdfParser implements IFileParser {
  private static readonly SUPPORTED = new Set(['.pdf']);

  validate(fileExtension: string): boolean {
    return PdfParser.SUPPORTED.has(fileExtension.toLowerCase());
  }

  async parse(fileBuffer: Buffer): Promise<ParsedFile> {
    return {
      type: 'image',
      content: fileBuffer.toString('base64'),
      mimeType: 'application/pdf',
    };
  }
}
