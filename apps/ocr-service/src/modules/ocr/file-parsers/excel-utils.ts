import * as XLSX from 'xlsx';

/**
 * Đọc merged cells từ sheet, forward-fill giá trị về toàn bộ vùng được gộp,
 * rồi detect multi-level header (2 hàng đầu có horizontal merge).
 *
 * Ví dụ bảng:
 *   Row 0: NAME | AREA | Brand(span 5) | | | | | Group(span 4) | | | | SCALES(span 3) | |
 *   Row 1:      |      | SP | AP | SINGTEC | SINO | OEM | HDEO | PCMO | MCO | IO | L | M | S
 * → headers: ["NAME","AREA","Brand > SP","Brand > AP","Brand > SINGTEC",...]
 */
export function flattenMergedHeaders(
  sheet: XLSX.WorkSheet,
  rawRows: string[][],
): { headers: string[]; bodyRows: string[][] } {
  if (rawRows.length === 0) return { headers: [], bodyRows: [] };

  const merges: XLSX.Range[] = sheet['!merges'] ?? [];
  const maxCols = rawRows.reduce((m, r) => Math.max(m, r.length), 0);

  // Xây filled grid: đảm bảo mọi row đủ maxCols cột
  const filled: string[][] = rawRows.map(r =>
    Array.from({ length: maxCols }, (_, i) => String(r[i] ?? '').trim()),
  );

  // Forward-fill toàn bộ vùng merge (cả ngang lẫn dọc)
  for (const merge of merges) {
    const topLeft = filled[merge.s.r]?.[merge.s.c] ?? '';
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (filled[r]) filled[r]![c] = topLeft;
      }
    }
  }

  // Detect multi-level header: hàng 0 có horizontal merge (span ≥ 2 cột)
  // VÀ hàng 1 không trống
  const hasHorizMerge = merges.some(m => m.s.r === 0 && m.e.c > m.s.c);
  const row1HasContent = filled[1]?.some(c => c !== '') ?? false;

  let headerRowCount = 1;
  let headers: string[];

  if (hasHorizMerge && row1HasContent) {
    headerRowCount = 2;
    headers = Array.from({ length: maxCols }, (_, i) => {
      const top = filled[0]?.[i] ?? '';
      const sub = filled[1]?.[i] ?? '';
      if (top && sub && top !== sub) return `${top} > ${sub}`;
      return top || sub;
    });
  } else {
    headers = Array.from({ length: maxCols }, (_, i) => filled[0]?.[i] ?? '');
  }

  // Tập hợp "chữ ký" của các header row để lọc các dòng header lặp lại
  const headerSigs = new Set<string>();
  for (let h = 0; h < headerRowCount; h++) {
    const sig = (filled[h] ?? []).join('|');
    if (sig.replace(/\|/g, '').trim()) headerSigs.add(sig);
  }

  // Body rows: bỏ header rows và bỏ các dòng header lặp lại giữa sheet
  const bodyRows = filled.slice(headerRowCount).filter(row => {
    if (!row.some(c => c !== '')) return false;          // bỏ dòng trống hoàn toàn
    return !headerSigs.has(row.join('|'));                // bỏ dòng trùng header
  });

  return { headers, bodyRows };
}

/** Chuyển headers + bodyRows thành Markdown Table gửi cho AI. */
export function toMarkdownTable(headers: string[], bodyRows: string[][]): string {
  if (headers.length === 0) return '';
  const maxCols = Math.max(headers.length, ...bodyRows.map(r => r.length));
  const pad = (arr: string[]) =>
    Array.from({ length: maxCols }, (_, i) => (arr[i] ?? '').replace(/\|/g, '\\|'));

  const sep = Array.from({ length: maxCols }, () => '---');
  return [
    `| ${pad(headers).join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...bodyRows.map(r => `| ${pad(r).join(' | ')} |`),
  ].join('\n');
}
