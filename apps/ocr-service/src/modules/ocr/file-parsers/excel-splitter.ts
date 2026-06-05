import * as XLSX from 'xlsx';
import { flattenMergedHeaders, toMarkdownTable } from './excel-utils';

const BATCH_ROWS = 80;

export interface ExcelChunk {
  label: string;
  content: string;
}

/**
 * Chia Excel thành các chunk text để gọi AI song song.
 * - Mỗi sheet → ít nhất 1 chunk
 * - Sheet > BATCH_ROWS dòng → chia batch, mỗi batch giữ lại header đã flatten
 * - Hỗ trợ header 2 tầng (merged cells) và bỏ qua header lặp lại giữa sheet
 */
export function splitExcelToChunks(buffer: Buffer): ExcelChunk[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const chunks: ExcelChunk[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as string[][];

    const nonEmpty = rawRows.filter(r => r.some(c => String(c).trim() !== ''));
    if (nonEmpty.length === 0) continue;

    const { headers, bodyRows } = flattenMergedHeaders(sheet, nonEmpty);

    if (bodyRows.length <= BATCH_ROWS) {
      chunks.push({
        label: sheetName,
        content: `## Sheet: ${sheetName}\n\n${toMarkdownTable(headers, bodyRows)}`,
      });
    } else {
      const totalBatches = Math.ceil(bodyRows.length / BATCH_ROWS);
      for (let start = 0; start < bodyRows.length; start += BATCH_ROWS) {
        const batchBody = bodyRows.slice(start, start + BATCH_ROWS);
        const batchNum = Math.floor(start / BATCH_ROWS) + 1;
        chunks.push({
          label: `${sheetName} (phần ${batchNum}/${totalBatches})`,
          content: `## Sheet: ${sheetName} (dòng ${start + 1}–${start + batchBody.length})\n\n${toMarkdownTable(headers, batchBody)}`,
        });
      }
    }
  }

  return chunks;
}
