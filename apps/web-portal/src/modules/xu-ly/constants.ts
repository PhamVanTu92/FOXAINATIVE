export const STATUS_CONFIG_FULL = {
  DRAFT:       { label: 'Đang xử lý',    cls: 'bg-dark-50    text-dark-500    border-dark-200'    },
  PROCESSED:   { label: 'Nháp',          cls: 'bg-orange-50  text-orange-600  border-orange-200'  },
  CONFIRMED:   { label: 'Đã xác nhận',   cls: 'bg-success-50 text-success-600 border-success-200' },
  TRANSFERRED: { label: 'Đã chuyển kho', cls: 'bg-violet-50  text-violet-600  border-violet-200'  },
  ERROR:       { label: 'Lỗi',           cls: 'bg-danger-50  text-danger-600  border-danger-200'  },
} as const;

export const TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  INVOICE:           { label: 'Hóa đơn VAT',    cls: 'bg-primary-50 text-primary-600 border-primary-200' },
  RECEIPT:           { label: 'Hóa đơn bán lẻ', cls: 'bg-teal-50    text-teal-600    border-teal-200'    },
  CONTRACT:          { label: 'Hợp đồng',        cls: 'bg-success-50 text-success-600 border-success-200' },
  STATEMENT:         { label: 'Bảng kê',         cls: 'bg-dark-50    text-dark-600    border-dark-200'    },
  MINUTES:           { label: 'Biên bản',        cls: 'bg-sky-50     text-sky-600     border-sky-200'     },
  WAREHOUSE_RECEIPT: { label: 'Phiếu nhập kho',  cls: 'bg-teal-50    text-teal-600    border-teal-200'    },
  OTHERS:            { label: 'Khác',            cls: 'bg-dark-50    text-dark-500    border-dark-200'    },
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
