/**
 * Kết quả sau khi parse file thành định dạng mà AI có thể tiêu thụ.
 * - type 'image': gửi dưới dạng vision input (base64), dùng cho PDF và ảnh
 * - type 'text': gửi dưới dạng văn bản/Markdown trong prompt, dùng cho Excel và Word
 */
export interface ParsedFile {
  type: 'image' | 'text';
  /** base64 string (với image) hoặc chuỗi Markdown/plaintext (với text) */
  content: string;
  /** Chỉ có với type='image': MIME type của dữ liệu base64 */
  mimeType?: string;
}

/**
 * Contract chung cho mọi FileParser.
 * Áp dụng Strategy Pattern: mỗi loại file có một strategy parse riêng.
 */
export interface IFileParser {
  /** Kiểm tra parser này có xử lý được extension cho trước không (ví dụ: '.pdf', '.xlsx') */
  validate(fileExtension: string): boolean;

  /**
   * Đọc buffer và trả về dạng mà AI layer có thể tiêu thụ trực tiếp.
   * @param fileBuffer - Nội dung file dạng Buffer
   * @param filePath   - Đường dẫn file gốc, dùng để suy ra MIME type nếu cần
   */
  parse(fileBuffer: Buffer, filePath: string): Promise<ParsedFile>;
}
