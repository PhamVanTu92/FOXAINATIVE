import { PrismaClient, DocumentType, FieldDataType, FieldPosition } from '.prisma/ocr-client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 [OCR DB] Bắt đầu seed dữ liệu mẫu...');

  const schema = await prisma.documentSchema.upsert({
    where: { code: 'INVOICE-VAT-IN' },
    update: {},
    create: {
      code: 'INVOICE-VAT-IN',
      name: 'Hóa đơn GTGT đầu vào',
      type: DocumentType.INVOICE,
      description: 'Schema mặc định cho hóa đơn giá trị gia tăng đầu vào theo chuẩn Việt Nam',
      isActive: true,
      createdBy: 'system',
    },
  });

  console.log(`✓ Schema: ${schema.code}`);

  const fields = [
    { fieldKey: 'invoiceNumber', label: 'Số hóa đơn', dataType: FieldDataType.TEXT, position: FieldPosition.HEADER, isRequired: true, isUnique: true, displayOrder: 1 },
    { fieldKey: 'issueDate', label: 'Ngày phát hành', dataType: FieldDataType.DATE, position: FieldPosition.HEADER, isRequired: true, displayOrder: 2 },
    { fieldKey: 'sellerTaxCode', label: 'Mã số thuế người bán', dataType: FieldDataType.TEXT, position: FieldPosition.HEADER, isRequired: true, validationRegex: '^[0-9\\-]{10,13}$', displayOrder: 3 },
    { fieldKey: 'sellerName', label: 'Tên người bán', dataType: FieldDataType.TEXT, position: FieldPosition.HEADER, isRequired: true, displayOrder: 4 },
    { fieldKey: 'totalAmount', label: 'Tổng tiền hàng', dataType: FieldDataType.CURRENCY, position: FieldPosition.FOOTER, isRequired: true, displayOrder: 5 },
    { fieldKey: 'vatAmount', label: 'Tiền thuế VAT', dataType: FieldDataType.CURRENCY, position: FieldPosition.FOOTER, isRequired: true, displayOrder: 6 },
    { fieldKey: 'grandTotal', label: 'Tổng thanh toán', dataType: FieldDataType.CURRENCY, position: FieldPosition.FOOTER, isRequired: true, displayOrder: 7 },
  ];

  for (const field of fields) {
    await prisma.documentField.upsert({
      where: { schemaId_fieldKey: { schemaId: schema.id, fieldKey: field.fieldKey } },
      update: field,
      create: { ...field, schemaId: schema.id },
    });
  }

  console.log(`✓ ${fields.length} trường đơn`);

  const table = await prisma.documentTable.upsert({
    where: { schemaId_tableKey: { schemaId: schema.id, tableKey: 'lineItems' } },
    update: {},
    create: { schemaId: schema.id, tableKey: 'lineItems', name: 'Chi tiết hàng hóa dịch vụ', displayOrder: 1 },
  });

  const columns = [
    { columnKey: 'stt', label: 'STT', dataType: FieldDataType.NUMBER, isRequired: true, displayOrder: 1 },
    { columnKey: 'name', label: 'Tên hàng hóa/dịch vụ', dataType: FieldDataType.TEXT, isRequired: true, displayOrder: 2 },
    { columnKey: 'unit', label: 'ĐVT', dataType: FieldDataType.TEXT, isRequired: false, displayOrder: 3 },
    { columnKey: 'quantity', label: 'Số lượng', dataType: FieldDataType.NUMBER, isRequired: true, displayOrder: 4 },
    { columnKey: 'unitPrice', label: 'Đơn giá', dataType: FieldDataType.NUMBER, isRequired: true, displayOrder: 5 },
    { columnKey: 'amount', label: 'Thành tiền', dataType: FieldDataType.NUMBER, isRequired: true, displayOrder: 6 },
  ];

  for (const col of columns) {
    await prisma.documentTableColumn.upsert({
      where: { tableId_columnKey: { tableId: table.id, columnKey: col.columnKey } },
      update: col,
      create: { ...col, tableId: table.id },
    });
  }

  console.log(`✓ ${columns.length} cột bảng lặp`);
  console.log('✅ [OCR DB] Seed hoàn tất.');
}

main()
  .catch((err) => { console.error('❌ Lỗi seed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
