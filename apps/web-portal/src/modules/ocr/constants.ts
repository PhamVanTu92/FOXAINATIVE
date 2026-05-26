import type { DataType, DocType, FieldPosition } from '@/lib/ocr-api';

export const TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'INVOICE',           label: 'Hóa đơn' },
  { value: 'RECEIPT',           label: 'Hóa đơn bán lẻ' },
  { value: 'CONTRACT',          label: 'Hợp đồng' },
  { value: 'STATEMENT',         label: 'Bảng kê' },
  { value: 'MINUTES',           label: 'Biên bản' },
  { value: 'WAREHOUSE_RECEIPT', label: 'Phiếu nhập kho' },
  { value: 'OTHERS',            label: 'Khác' },
];

export const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  INVOICE:           { label: 'Hóa đơn',         color: 'bg-blue-100 text-blue-700 border border-blue-200' },
  RECEIPT:           { label: 'Hóa đơn bán lẻ',  color: 'bg-teal-100 text-teal-700 border border-teal-200' },
  CONTRACT:          { label: 'Hợp đồng',         color: 'bg-green-100 text-green-700 border border-green-200' },
  STATEMENT:         { label: 'Bảng kê',          color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  MINUTES:           { label: 'Biên bản',         color: 'bg-amber-100 text-amber-700 border border-amber-200' },
  WAREHOUSE_RECEIPT: { label: 'Phiếu nhập kho',   color: 'bg-purple-100 text-purple-700 border border-purple-200' },
  OTHERS:            { label: 'Khác',             color: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

export const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
  { value: 'TEXT',     label: 'Văn bản' },
  { value: 'DATE',     label: 'Ngày tháng' },
  { value: 'NUMBER',   label: 'Số' },
  { value: 'CURRENCY', label: 'Tiền tệ' },
  { value: 'BOOLEAN',  label: 'Đúng/Sai' },
  { value: 'LIST',     label: 'Danh sách' },
];

export const POSITION_OPTIONS: { value: FieldPosition; label: string }[] = [
  { value: 'HEADER', label: 'Header' },
  { value: 'FOOTER', label: 'Footer' },
  { value: 'BODY',   label: 'Body' },
];

export const PROMPT_TEMPLATES: { id: string; label: string; text: string }[] = [
  {
    id: 'merged-rows',
    label: 'Bảng gộp dòng (Merged rows)',
    text: 'Bảng dữ liệu có thể chứa các ô được gộp (merged cells). Khi gặp ô gộp theo chiều dọc, hãy lặp lại giá trị của ô đó cho tất cả các dòng thuộc ô gộp. Không để trống bất kỳ ô nào trong cột.',
  },
  {
    id: 'skip-empty-rows',
    label: 'Bỏ qua dòng trống / dòng rác',
    text: 'Bỏ qua các dòng trống hoặc dòng chỉ chứa ký tự gạch ngang (---), dấu chấm (...) hoặc ký tự đặc biệt không mang thông tin. Chỉ lấy các dòng có dữ liệu thực sự.',
  },
  {
    id: 'handwriting',
    label: 'Bảng có chữ viết tay',
    text: 'Tài liệu có thể chứa phần điền tay kết hợp với phần in sẵn. Hãy ưu tiên đọc chính xác phần chữ viết tay, kể cả khi nét chữ không rõ ràng. Nếu không đọc được, ghi nhận là null thay vì đoán sai.',
  },
  {
    id: 'flat-json-merged',
    label: 'Flat JSON + Forward-fill ô gộp',
    text: 'Hãy trích xuất bảng thành một mảng JSON phẳng (Flat JSON Array), không lồng nhau.\n\nQuy tắc xử lý ô gộp (Merged Cells):\n- Tại các cột bị gộp dọc, bắt buộc phải LẶP LẠI (Forward-fill) giá trị đó cho từng dòng dữ liệu con. Không được để trống hoặc dùng mảng lồng.\n- Các ô không có dữ liệu thì để chuỗi rỗng "".',
  },
];

export function toKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}
