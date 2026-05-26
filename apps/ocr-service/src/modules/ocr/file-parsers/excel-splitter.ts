import * as XLSX from 'xlsx';

const BATCH_ROWS = 80;

export interface ExcelChunk {
  label: string;
  content: string;
}

/**
 * Chia Excel thành các chunk text để gọi AI song song.
 * - Mỗi sheet → ít nhất 1 chunk
 * - Sheet > BATCH_ROWS dòng → chia thành nhiều batch, mỗi batch giữ lại header row
 */
export function splitExcelToChunks(buffer: Buffer): ExcelChunk[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const chunks: ExcelChunk[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as string[][];

    const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ''));
    if (nonEmpty.length === 0) continue;

    const [headerRow = [], ...bodyRows] = nonEmpty;

    if (bodyRows.length <= BATCH_ROWS) {
      chunks.push({
        label: sheetName,
        content: `## Sheet: ${sheetName}\n\n${toMarkdownTable(nonEmpty)}`,
      });
    } else {
      const totalBatches = Math.ceil(bodyRows.length / BATCH_ROWS);
      for (let start = 0; start < bodyRows.length; start += BATCH_ROWS) {
        const batchBody = bodyRows.slice(start, start + BATCH_ROWS);
        const batchNum = Math.floor(start / BATCH_ROWS) + 1;
        chunks.push({
          label: `${sheetName} (phần ${batchNum}/${totalBatches})`,
          content: `## Sheet: ${sheetName} (dòng ${start + 1}–${start + batchBody.length})\n\n${toMarkdownTable([headerRow, ...batchBody])}`,
        });
      }
    }
  }

  return chunks;
}

function toMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  const [firstRow = [], ...bodyRows] = rows;
  const maxCols = Math.max(...rows.map(r => r.length));
  const normalize = (row: string[]) =>
    Array.from({ length: maxCols }, (_, i) => String(row[i] ?? '').replace(/\|/g, '\\|'));

  const header = normalize(firstRow);
  const separator = header.map(() => '---');
  const body = bodyRows.map(normalize);

  return [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`),
  ].join('\n');
}
