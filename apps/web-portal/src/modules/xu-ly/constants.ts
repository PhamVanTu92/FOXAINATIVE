export const STATUS_CONFIG_FULL = {
  DRAFT:       { label: 'Đang xử lý',    cls: 'bg-slate-100    text-slate-500    border-slate-200'    },
  PROCESSED:   { label: 'Nháp',          cls: 'bg-orange-100  text-orange-600  border-orange-200'  },
  CONFIRMED:   { label: 'Đã xác nhận',   cls: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  TRANSFERRED: { label: 'Đã chuyển kho', cls: 'bg-violet-100  text-violet-600  border-violet-200'  },
  ERROR:       { label: 'Lỗi',           cls: 'bg-rose-100  text-rose-600  border-rose-200'  },
} as const;

export const TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  INVOICE:           { label: 'Hóa đơn VAT',    cls: 'bg-blue-100 text-blue-600 border-blue-200' },
  RECEIPT:           { label: 'Hóa đơn bán lẻ', cls: 'bg-teal-100    text-teal-600    border-teal-200'    },
  CONTRACT:          { label: 'Hợp đồng',        cls: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  STATEMENT:         { label: 'Bảng kê',         cls: 'bg-slate-100    text-slate-600    border-slate-200'    },
  MINUTES:           { label: 'Biên bản',        cls: 'bg-sky-100     text-sky-600     border-sky-200'     },
  WAREHOUSE_RECEIPT: { label: 'Phiếu nhập kho',  cls: 'bg-teal-100    text-teal-600    border-teal-200'    },
  OTHERS:            { label: 'Khác',            cls: 'bg-slate-100    text-slate-500    border-slate-200'    },
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
