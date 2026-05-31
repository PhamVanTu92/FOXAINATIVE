import * as XLSX from 'xlsx';
import type { IFileParser, ParsedFile } from './file-parser.interface';
import { flattenMergedHeaders, toMarkdownTable } from './excel-utils';

/**
 * Đọc file Excel (XLSX, XLS) hoặc CSV và chuyển toàn bộ dữ liệu
 * thành chuỗi Markdown Table gửi cho AI.
 *
 * Hỗ trợ:
 * - Header 2 tầng (merged cells ngang): tự động gộp thành "Brand > SP"
 * - Forward-fill ô merge dọc trong body
 * - Bỏ qua dòng header lặp lại giữa sheet
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

      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as string[][];

      const nonEmpty = rawRows.filter(r => r.some(c => String(c).trim() !== ''));
      if (nonEmpty.length === 0) continue;

      const { headers, bodyRows } = flattenMergedHeaders(sheet, nonEmpty);
      sections.push(`## Sheet: ${sheetName}\n\n${toMarkdownTable(headers, bodyRows)}`);
    }

    return {
      type: 'text',
      content: sections.length > 0 ? sections.join('\n\n') : '(File Excel không có dữ liệu)',
    };
  }
}
