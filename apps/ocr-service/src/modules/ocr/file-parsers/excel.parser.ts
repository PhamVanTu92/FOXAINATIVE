import * as XLSX from 'xlsx';
import type { IFileParser, ParsedFile } from './file-parser.interface';

/**
 * Đọc file Excel (XLSX, XLS) hoặc CSV và chuyển toàn bộ dữ liệu
 * thành chuỗi Markdown Table.
 *
 * Lý do dùng Markdown Table: AI đọc dạng bảng này cực kỳ tốt, không bị
 * lệch cột hay nhầm lẫn giữa các số tiền liên tiếp nhau.
 *
 * Thư viện: `xlsx` (SheetJS) – hỗ trợ XLSX, XLS, CSV, ODS, ...
 */
export class ExcelParser implements IFileParser {
  private static readonly SUPPORTED = new Set(['.xlsx', '.xls', '.csv']);

  validate(fileExtension: string): boolean {
    return ExcelParser.SUPPORTED.has(fileExtension.toLowerCase());
  }

  async parse(fileBuffer: Buffer): Promise<ParsedFile> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sections: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // header: 1 → trả về mảng của mảng (không dùng row đầu làm key)
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',   // ô trống = chuỗi rỗng thay vì undefined
        raw: false,   // ép mọi giá trị về string (số tiền giữ nguyên format)
      });

      // Bỏ qua sheet trống
      const nonEmptyRows = (rows as string[][]).filter(r => r.some(cell => String(cell).trim() !== ''));
      if (nonEmptyRows.length === 0) continue;

      sections.push(`## Sheet: ${sheetName}\n\n${this.toMarkdownTable(nonEmptyRows)}`);
    }

    return {
      type: 'text',
      content: sections.length > 0 ? sections.join('\n\n') : '(File Excel không có dữ liệu)',
    };
  }

  /**
   * Chuyển mảng 2 chiều thành chuỗi Markdown Table.
   * Dòng đầu tiên được dùng làm header.
   */
  private toMarkdownTable(rows: string[][]): string {
    if (rows.length === 0) return '';

    // Chuẩn hóa: đảm bảo mọi row có cùng số cột bằng cột tối đa
    const [firstRow, ...bodyRows] = rows;
    const maxCols = Math.max(...rows.map(r => r.length));
    const normalize = (row: string[]) =>
      Array.from({ length: maxCols }, (_, i) => String(row[i] ?? '').replace(/\|/g, '\\|'));

    const header = normalize(firstRow ?? []);
    const separator = header.map(() => '---');
    const body = bodyRows.map(normalize);

    return [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...body.map(row => `| ${row.join(' | ')} |`),
    ].join('\n');
  }
}
