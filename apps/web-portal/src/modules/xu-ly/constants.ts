export const STATUS_CONFIG_FULL = {
  DRAFT:       { label: 'Đang xử lý',    cls: 'bg-gray-50    text-gray-500   border-gray-200'  },
  PROCESSED:   { label: 'Nháp',          cls: 'bg-orange-50  text-orange-600 border-orange-200' },
  CONFIRMED:   { label: 'Đã xác nhận',   cls: 'bg-green-50   text-green-600  border-green-200'  },
  TRANSFERRED: { label: 'Đã chuyển kho', cls: 'bg-purple-50  text-purple-600 border-purple-200' },
  ERROR:       { label: 'Lỗi',           cls: 'bg-red-50     text-red-600    border-red-200'    },
} as const;

export const TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  INVOICE:           { label: 'Hóa đơn VAT',    cls: 'bg-blue-50  text-blue-600  border-blue-200' },
  RECEIPT:           { label: 'Hóa đơn bán lẻ', cls: 'bg-cyan-50  text-cyan-600  border-cyan-200' },
  CONTRACT:          { label: 'Hợp đồng',        cls: 'bg-green-50 text-green-600 border-green-200' },
  STATEMENT:         { label: 'Bảng kê',         cls: 'bg-gray-50  text-gray-600  border-gray-200' },
  MINUTES:           { label: 'Biên bản',        cls: 'bg-sky-50   text-sky-600   border-sky-200' },
  WAREHOUSE_RECEIPT: { label: 'Phiếu nhập kho',  cls: 'bg-teal-50  text-teal-600  border-teal-200' },
  OTHERS:            { label: 'Khác',            cls: 'bg-gray-50  text-gray-500  border-gray-200' },
};

export const STANDARD_COLUMNS = [
  { key: 'name',      numeric: false },
  { key: 'unit',      numeric: false },
  { key: 'quantity',  numeric: true  },
  { key: 'unitPrice', numeric: true  },
  { key: 'amount',    numeric: true  },
] as const;

export const STANDARD_FIELD_KEYS = new Set<string>(STANDARD_COLUMNS.map(c => c.key));

export function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
}

export function fmtNum(n: number | string | null | undefined) {
  if (n == null) return '—';
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '—';
  return new Intl.NumberFormat('vi-VN').format(v);
}
