/**
 * Sinh file PDF mẫu Hóa đơn GTGT đầu vào
 *
 * Dữ liệu mẫu khớp với schema INVOICE-VAT-IN được tạo trong seed.ts:
 *   - 7 trường đơn: invoiceNumber, issueDate, sellerTaxCode, sellerName,
 *                   totalAmount, vatAmount, grandTotal
 *   - Bảng lineItems: stt, name, unit, quantity, unitPrice, amount
 *
 * Output: docs/samples/hoa-don-gtgt-mau.pdf
 *
 * Yêu cầu: pnpm add -Dw pdfkit @types/pdfkit
 */

'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ─── Dữ liệu mẫu ────────────────────────────────────────────────────────────

const INVOICE = {
  invoiceNumber: '0000123',
  issueDate: '20/05/2026',
  series: 'AA/26E',
  formNumber: '01GTKT0/001',

  seller: {
    name: 'CÔNG TY TNHH ABC TRADING',
    address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    taxCode: '0312345678',
    phone: '028 3822 1234',
    bankAccount: '1234567890 - Ngân hàng TMCP Ngoại thương (Vietcombank)',
  },

  buyer: {
    name: 'CÔNG TY CỔ PHẦN XYZ SOLUTIONS',
    address: '456 Lê Văn Lương, Phường Tân Hưng, Quận 7, TP. Hồ Chí Minh',
    taxCode: '0398765432',
  },

  lineItems: [
    {
      stt: 1,
      name: 'Dịch vụ tư vấn thiết kế hệ thống phần mềm ERP',
      unit: 'Giờ',
      quantity: 80,
      unitPrice: 500_000,
      amount: 40_000_000,
    },
    {
      stt: 2,
      name: 'Bản quyền phần mềm quản lý kho ERP Module',
      unit: 'Bản',
      quantity: 1,
      unitPrice: 20_000_000,
      amount: 20_000_000,
    },
    {
      stt: 3,
      name: 'Dịch vụ triển khai, cài đặt và đào tạo',
      unit: 'Lần',
      quantity: 1,
      unitPrice: 15_000_000,
      amount: 15_000_000,
    },
    {
      stt: 4,
      name: 'Hỗ trợ kỹ thuật 12 tháng (Gói Enterprise)',
      unit: 'Gói',
      quantity: 1,
      unitPrice: 12_000_000,
      amount: 12_000_000,
    },
  ],

  totalAmount: 87_000_000,
  vatRate: 10,
  vatAmount: 8_700_000,
  grandTotal: 95_700_000,

  paymentMethod: 'Chuyển khoản ngân hàng',
  note: 'Thanh toán trong vòng 30 ngày kể từ ngày xuất hóa đơn.',
};

// ─── Tiện ích ────────────────────────────────────────────────────────────────

/** Định dạng tiền VND */
function fmt(n) {
  return n.toLocaleString('vi-VN');
}

/** Đường dẫn font chữ hỗ trợ tiếng Việt trên Windows */
const FONT_WIN = {
  regular: 'C:\\Windows\\Fonts\\arial.ttf',
  bold: 'C:\\Windows\\Fonts\\arialbd.ttf',
  italic: 'C:\\Windows\\Fonts\\ariali.ttf',
};

function resolveFont(variant = 'regular') {
  const p = FONT_WIN[variant];
  if (fs.existsSync(p)) return p;
  // Fallback: dùng font nhúng sẵn của pdfkit (không hỗ trợ dấu tiếng Việt)
  console.warn(`[WARN] Không tìm thấy font ${p}. Dấu tiếng Việt có thể bị thiếu.`);
  return 'Helvetica';
}

// ─── Hằng số layout ──────────────────────────────────────────────────────────

const PAGE = { size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } };
const W = 595 - PAGE.margins.left - PAGE.margins.right; // chiều rộng nội dung

const C = {
  red: '#c0392b',
  blue: '#1a5276',
  black: '#1a1a1a',
  gray: '#555555',
  lightGray: '#e8e8e8',
  white: '#ffffff',
  green: '#1e8449',
};

// ─── Sinh PDF ────────────────────────────────────────────────────────────────

function generate(outputPath) {
  const doc = new PDFDocument(PAGE);
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const fontR = resolveFont('regular');
  const fontB = resolveFont('bold');
  const fontI = resolveFont('italic');

  const L = PAGE.margins.left;
  const T = PAGE.margins.top;

  // ── Tiêu đề hóa đơn ──────────────────────────────────────────────────────
  doc.font(fontB).fontSize(8).fillColor(C.gray)
    .text('Mẫu số:', L, T, { continued: true })
    .font(fontR).text(` ${INVOICE.formNumber}`, { continued: false });

  doc.font(fontB).fontSize(16).fillColor(C.red)
    .text('HÓA ĐƠN GIÁ TRỊ GIA TĂNG', L, T + 14, { align: 'center', width: W });

  doc.font(fontI).fontSize(9).fillColor(C.gray)
    .text('(VAT INVOICE)', L, T + 34, { align: 'center', width: W });

  doc.font(fontB).fontSize(9).fillColor(C.black)
    .text(`Ký hiệu: ${INVOICE.series}`, L, T + 14, { align: 'right', width: W });
  doc.font(fontB).fontSize(9).fillColor(C.black)
    .text(`Số:  ${INVOICE.invoiceNumber}`, L, T + 28, { align: 'right', width: W });

  // đường kẻ dưới tiêu đề
  const lineY = T + 50;
  doc.moveTo(L, lineY).lineTo(L + W, lineY).lineWidth(1.5).strokeColor(C.red).stroke();

  // ── Thông tin người bán ───────────────────────────────────────────────────
  let y = lineY + 10;
  doc.font(fontB).fontSize(10).fillColor(C.blue)
    .text('ĐƠN VỊ BÁN HÀNG:', L, y);
  y += 14;

  doc.font(fontB).fontSize(10).fillColor(C.black)
    .text(INVOICE.seller.name, L, y);
  y += 13;

  doc.font(fontR).fontSize(9).fillColor(C.black)
    .text(`Địa chỉ: ${INVOICE.seller.address}`, L, y);
  y += 12;

  doc.font(fontR).fontSize(9)
    .text(`Mã số thuế: `, L, y, { continued: true })
    .font(fontB).text(INVOICE.seller.taxCode, { continued: true })
    .font(fontR).text(`        Điện thoại: ${INVOICE.seller.phone}`);
  y += 12;

  doc.font(fontR).fontSize(9)
    .text(`Số tài khoản: ${INVOICE.seller.bankAccount}`, L, y);
  y += 14;

  // đường kẻ phân cách
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(C.lightGray).stroke();
  y += 8;

  // ── Thông tin người mua ───────────────────────────────────────────────────
  doc.font(fontB).fontSize(10).fillColor(C.blue)
    .text('ĐƠN VỊ MUA HÀNG:', L, y);
  y += 14;

  doc.font(fontB).fontSize(10).fillColor(C.black)
    .text(INVOICE.buyer.name, L, y);
  y += 13;

  doc.font(fontR).fontSize(9)
    .text(`Địa chỉ: ${INVOICE.buyer.address}`, L, y);
  y += 12;

  doc.font(fontR).fontSize(9)
    .text(`Mã số thuế: `, L, y, { continued: true })
    .font(fontB).text(INVOICE.buyer.taxCode, { continued: true })
    .font(fontR).text(`        Hình thức thanh toán: ${INVOICE.paymentMethod}`);
  y += 12;

  doc.font(fontR).fontSize(9)
    .text(`Ngày phát hành: `, L, y, { continued: true })
    .font(fontB).text(INVOICE.issueDate);
  y += 16;

  // ── Bảng chi tiết hàng hóa ───────────────────────────────────────────────
  // định nghĩa cột (tổng W pixels)
  const cols = {
    stt:       { x: L,           w: 30,  align: 'center' },
    name:      { x: L + 30,      w: 215, align: 'left'   },
    unit:      { x: L + 245,     w: 45,  align: 'center' },
    quantity:  { x: L + 290,     w: 55,  align: 'right'  },
    unitPrice: { x: L + 345,     w: 70,  align: 'right'  },
    amount:    { x: L + 415,     w: 80,  align: 'right'  },
  };

  // header bảng
  const rowH = 20;
  doc.rect(L, y, W, rowH).fill(C.blue);

  const headers = [
    { key: 'stt',       label: 'STT' },
    { key: 'name',      label: 'Tên hàng hóa/dịch vụ' },
    { key: 'unit',      label: 'ĐVT' },
    { key: 'quantity',  label: 'Số lượng' },
    { key: 'unitPrice', label: 'Đơn giá' },
    { key: 'amount',    label: 'Thành tiền' },
  ];

  doc.font(fontB).fontSize(8.5).fillColor(C.white);
  for (const h of headers) {
    const c = cols[h.key];
    doc.text(h.label, c.x + 2, y + 5, { width: c.w - 4, align: c.align });
  }
  y += rowH;

  // các dòng hàng hóa
  INVOICE.lineItems.forEach((item, idx) => {
    const rowColor = idx % 2 === 0 ? C.white : '#f2f8ff';
    doc.rect(L, y, W, rowH).fill(rowColor);

    doc.font(fontR).fontSize(8.5).fillColor(C.black);
    const row = {
      stt:       String(item.stt),
      name:      item.name,
      unit:      item.unit,
      quantity:  fmt(item.quantity),
      unitPrice: fmt(item.unitPrice),
      amount:    fmt(item.amount),
    };
    for (const h of headers) {
      const c = cols[h.key];
      doc.text(row[h.key], c.x + 2, y + 5, { width: c.w - 4, align: c.align });
    }

    // viền ngang
    doc.moveTo(L, y + rowH).lineTo(L + W, y + rowH)
      .lineWidth(0.3).strokeColor('#cccccc').stroke();
    y += rowH;
  });

  // viền ngoài bảng
  doc.rect(L, y - INVOICE.lineItems.length * rowH - rowH, W,
           INVOICE.lineItems.length * rowH + rowH)
    .lineWidth(0.8).strokeColor(C.blue).stroke();

  y += 10;

  // ── Tổng tiền ─────────────────────────────────────────────────────────────
  const summaryX = L + W - 250;
  const summaryW = 250;

  function summaryRow(label, value, bold = false, color = C.black) {
    if (bold) {
      doc.font(fontB).fontSize(9).fillColor(color)
        .text(label, summaryX, y, { width: 155, align: 'left' })
        .text(value, summaryX + 155, y, { width: 95, align: 'right' });
    } else {
      doc.font(fontR).fontSize(9).fillColor(C.gray)
        .text(label, summaryX, y, { width: 155, align: 'left' });
      doc.font(fontR).fontSize(9).fillColor(C.black)
        .text(value, summaryX + 155, y, { width: 95, align: 'right' });
    }
    y += 14;
  }

  summaryRow('Cộng tiền hàng:', `${fmt(INVOICE.totalAmount)} đ`);
  summaryRow(`Thuế GTGT (${INVOICE.vatRate}%):`, `${fmt(INVOICE.vatAmount)} đ`);

  // dòng tổng thanh toán – nổi bật
  doc.rect(summaryX - 4, y - 2, summaryW + 4, 20).fill('#eaf4fb');
  summaryRow(
    'TỔNG THANH TOÁN:',
    `${fmt(INVOICE.grandTotal)} đ`,
    true,
    C.blue,
  );

  // số tiền bằng chữ
  doc.font(fontI).fontSize(8.5).fillColor(C.gray)
    .text(
      'Số tiền bằng chữ: Chín mươi lăm triệu bảy trăm nghìn đồng chẵn.',
      L, y, { width: W },
    );
  y += 20;

  // ghi chú
  if (INVOICE.note) {
    doc.font(fontI).fontSize(8).fillColor(C.gray)
      .text(`Ghi chú: ${INVOICE.note}`, L, y, { width: W });
    y += 16;
  }

  // ── Khu vực ký tên ────────────────────────────────────────────────────────
  y += 10;
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(C.lightGray).stroke();
  y += 14;

  const sigW = W / 2 - 10;
  doc.font(fontB).fontSize(9).fillColor(C.black)
    .text('NGƯỜI MUA HÀNG', L, y, { width: sigW, align: 'center' })
    .text('NGƯỜI BÁN HÀNG', L + sigW + 20, y, { width: sigW, align: 'center' });
  y += 12;

  doc.font(fontI).fontSize(8).fillColor(C.gray)
    .text('(Ký, ghi rõ họ tên)', L, y, { width: sigW, align: 'center' })
    .text('(Ký, đóng dấu, ghi rõ họ tên)', L + sigW + 20, y, { width: sigW, align: 'center' });

  y += 55;

  // ── Footer trang ──────────────────────────────────────────────────────────
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(C.lightGray).stroke();
  doc.font(fontI).fontSize(7.5).fillColor(C.gray)
    .text(
      'Hóa đơn điện tử này được tạo tự động bởi hệ thống FOXAI · Mã xác thực: FOXAI-2026-0000123',
      L, y + 6, { width: W, align: 'center' },
    );

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  const outDir = path.resolve(__dirname, '..', 'docs', 'samples');
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'hoa-don-gtgt-mau.pdf');
  console.log('📄 Đang tạo PDF mẫu Hóa đơn GTGT...');

  try {
    await generate(outPath);
    console.log(`✅ Tạo PDF thành công: ${outPath}`);
  } catch (err) {
    console.error('❌ Lỗi tạo PDF:', err);
    process.exit(1);
  }
})();
