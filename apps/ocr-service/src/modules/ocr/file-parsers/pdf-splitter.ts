import { PDFDocument } from 'pdf-lib';

/**
 * Tách PDF thành mảng buffer — mỗi phần tử là một trang độc lập.
 * Dùng cho parallel OCR: mỗi trang được scan song song thay vì tuần tự.
 */
export async function splitPdfToPages(buffer: Buffer): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(buffer);
  const pageCount = srcDoc.getPageCount();
  const pages: Buffer[] = [];

  for (let i = 0; i < pageCount; i++) {
    const pageDoc = await PDFDocument.create();
    const [copiedPage] = await pageDoc.copyPages(srcDoc, [i]);
    pageDoc.addPage(copiedPage);
    const bytes = await pageDoc.save();
    pages.push(Buffer.from(bytes));
  }

  return pages;
}
