import * as path from 'path';
import type { IFileParser } from './file-parser.interface';
import { PdfParser } from './pdf.parser';
import { ImageParser } from './image.parser';
import { ExcelParser } from './excel.parser';
import { WordParser } from './word.parser';

/**
 * Factory Pattern: tự động chọn Parser phù hợp dựa trên extension của file.
 *
 * Thứ tự đăng ký parser không quan trọng vì mỗi parser validate riêng biệt.
 * Để thêm định dạng mới: implement IFileParser rồi thêm vào PARSERS bên dưới.
 */
export class FileParserFactory {
  private static readonly PARSERS: IFileParser[] = [
    new PdfParser(),
    new ImageParser(),
    new ExcelParser(),
    new WordParser(),
  ];

  /**
   * Trả về parser phù hợp với file được chỉ định.
   * @param filePathOrExt - Đường dẫn đầy đủ (ví dụ: '/uploads/invoice.xlsx')
   *                        hoặc chỉ extension (ví dụ: '.xlsx')
   * @throws Error nếu không có parser nào hỗ trợ extension này
   */
  static getParser(filePathOrExt: string): IFileParser {
    const ext = filePathOrExt.startsWith('.')
      ? filePathOrExt
      : path.extname(filePathOrExt);

    const parser = this.PARSERS.find(p => p.validate(ext));
    if (!parser) {
      throw new Error(
        `Định dạng file "${ext}" không được hỗ trợ. ` +
        `Các định dạng hỗ trợ: PDF, PNG, JPG, JPEG, GIF, WEBP, TIFF, XLSX, XLS, CSV, DOCX.`,
      );
    }
    return parser;
  }

  /** Danh sách tất cả extension được hỗ trợ, dùng để validate ở controller nếu cần */
  static getSupportedExtensions(): string[] {
    return ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.tif', '.xlsx', '.xls', '.csv', '.docx'];
  }
}
