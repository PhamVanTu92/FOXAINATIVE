import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, Prisma } from '@foxai/ocr-db';
import { BulkActionDto, ConfirmDocumentDto, FilterDocumentDto, UpdateDocumentDto } from './dto/document.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OcrProducerService } from '../ocr/ocr-producer.service';

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ocrProducer: OcrProducerService,
  ) {}

  async createFromUpload(params: {
    schemaId: string; fileUrl: string; fileName?: string;
    fileSize?: number; mimeType?: string;
    language: 'vi' | 'en' | 'vi+en'; createdBy?: string;
  }) {
    const schema = await this.prisma.client.documentSchema.findUnique({ where: { id: params.schemaId } });
    if (!schema) throw new NotFoundException(`Không tìm thấy schema "${params.schemaId}".`);
    if (!schema.isActive) throw new BadRequestException(`Schema "${schema.code}" đã bị vô hiệu hóa.`);

    const document = await this.prisma.client.document.create({
      data: {
        schemaId: schema.id, schemaCode: schema.code,
        fileUrl: params.fileUrl, fileName: params.fileName,
        fileSize: params.fileSize, mimeType: params.mimeType,
        status: DocumentStatus.DRAFT, ocrLanguage: params.language,
        createdBy: params.createdBy ?? 'system',
      },
    });

    const job = await this.ocrProducer.enqueue({
      documentId: document.id, schemaId: schema.id,
      fileUrl: params.fileUrl, mimeType: params.mimeType,
      language: params.language,
    });

    await this.prisma.client.documentAuditLog.create({
      data: { documentId: document.id, action: 'CREATE', newStatus: DocumentStatus.DRAFT, changedBy: params.createdBy ?? 'system', note: 'Đã tải file và đẩy vào hàng đợi OCR.' },
    });

    return { documentId: document.id, jobId: job.id ?? null };
  }

  async getStats() {
    const [total, draft, confirmed, processed, error] = await this.prisma.client.$transaction([
      this.prisma.client.document.count(),
      this.prisma.client.document.count({ where: { status: DocumentStatus.DRAFT } }),
      this.prisma.client.document.count({ where: { status: DocumentStatus.CONFIRMED } }),
      this.prisma.client.document.count({ where: { status: DocumentStatus.PROCESSED } }),
      this.prisma.client.document.count({ where: { status: DocumentStatus.ERROR } }),
    ]);
    return { total, draft, confirmed, processed, error };
  }

  async findMany(filter: FilterDocumentDto) {
    const where: Prisma.DocumentWhereInput = {};
    if (filter.search) {
      where.OR = [
        { id: { contains: filter.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: filter.search, mode: 'insensitive' } },
        { sellerName: { contains: filter.search, mode: 'insensitive' } },
        { fileName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.status?.length) where.status = { in: filter.status };
    if (filter.schemaCode) where.schemaCode = filter.schemaCode;
    if (filter.type) where.schema = { type: filter.type };
    if (filter.sellerTaxCode) where.sellerTaxCode = filter.sellerTaxCode;
    if (filter.dateFrom || filter.dateTo) {
      where.issueDate = {
        gte: filter.dateFrom ? new Date(filter.dateFrom) : undefined,
        lte: filter.dateTo ? new Date(filter.dateTo) : undefined,
      };
    }
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.document.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize, take: pageSize,
        include: { schema: { select: { name: true, type: true } } },
      }),
      this.prisma.client.document.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const doc = await this.prisma.client.document.findUnique({
      where: { id },
      include: {
        schema: { include: { fields: true, tables: { include: { columns: true } } } },
        values: { include: { field: true } },
        lineItems: { orderBy: { stt: 'asc' } },
        auditLogs: { orderBy: { changedAt: 'desc' }, take: 50 },
      },
    });
    if (!doc) throw new NotFoundException(`Không tìm thấy chứng từ "${id}".`);
    return doc;
  }

  async update(id: string, dto: UpdateDocumentDto, changedBy = 'system') {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.DRAFT && doc.status !== DocumentStatus.PROCESSED)
      throw new ConflictException('Chỉ có thể sửa chứng từ ở trạng thái Nháp hoặc Đã xử lý.');

    await this.prisma.client.$transaction(async (tx) => {
      if (dto.values) {
        for (const v of dto.values) {
          await tx.documentValue.upsert({
            where: { documentId_fieldId: { documentId: id, fieldId: v.fieldId } },
            update: { stringValue: v.stringValue, isManuallyEdited: true },
            create: { documentId: id, fieldId: v.fieldId, stringValue: v.stringValue, isManuallyEdited: true },
          });
        }
      }
      if (dto.lineItems) {
        await tx.documentLineItem.deleteMany({ where: { documentId: id } });
        for (const li of dto.lineItems) {
          await tx.documentLineItem.create({
            data: { documentId: id, stt: li.stt, name: li.name, unit: li.unit, quantity: li.quantity, unitPrice: li.unitPrice, amount: li.amount, isManuallyAdded: !li.id },
          });
        }
      }
      await tx.documentAuditLog.create({ data: { documentId: id, action: 'EDIT_FIELD', changedBy, note: 'Người dùng chỉnh sửa giá trị.' } });
    });
    return this.findOne(id);
  }

  async confirm(id: string, dto: ConfirmDocumentDto, confirmedBy = 'system') {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.DRAFT && doc.status !== DocumentStatus.PROCESSED)
      throw new ConflictException('Chỉ chứng từ Nháp hoặc Đã xử lý mới có thể xác nhận.');
    await this.prisma.client.$transaction([
      this.prisma.client.document.update({ where: { id }, data: { status: DocumentStatus.CONFIRMED, confirmedAt: new Date(), confirmedBy } }),
      this.prisma.client.documentAuditLog.create({ data: { documentId: id, action: 'STATUS_CHANGE', oldStatus: doc.status, newStatus: DocumentStatus.CONFIRMED, changedBy: confirmedBy, note: dto.note } }),
    ]);
    return this.findOne(id);
  }

  async remove(id: string) {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.DRAFT && doc.status !== DocumentStatus.PROCESSED && doc.status !== DocumentStatus.ERROR)
      throw new ConflictException('Chỉ có thể xóa chứng từ ở trạng thái Nháp hoặc Lỗi.');
    await this.prisma.client.document.delete({ where: { id } });
    return { deleted: true };
  }

  async bulkConfirm(dto: BulkActionDto, confirmedBy = 'system') {
    const docs = await this.prisma.client.document.findMany({ where: { id: { in: dto.documentIds } }, select: { id: true, status: true } });
    const confirmable = docs.filter((d) => d.status === DocumentStatus.DRAFT || d.status === DocumentStatus.PROCESSED).map((d) => d.id);
    const skipped = docs.filter((d) => d.status !== DocumentStatus.DRAFT && d.status !== DocumentStatus.PROCESSED).map((d) => d.id);
    if (confirmable.length > 0) {
      await this.prisma.client.$transaction([
        this.prisma.client.document.updateMany({ where: { id: { in: confirmable } }, data: { status: DocumentStatus.CONFIRMED, confirmedAt: new Date(), confirmedBy } }),
        this.prisma.client.documentAuditLog.createMany({ data: confirmable.map((id) => ({ documentId: id, action: 'STATUS_CHANGE', newStatus: DocumentStatus.CONFIRMED, changedBy: confirmedBy, note: 'Xác nhận hàng loạt.' })) }),
      ]);
    }
    return { confirmed: confirmable.length, skipped };
  }

  async bulkDelete(dto: BulkActionDto) {
    const docs = await this.prisma.client.document.findMany({ where: { id: { in: dto.documentIds } }, select: { id: true, status: true } });
    const deletable = docs.filter((d) => d.status === DocumentStatus.DRAFT || d.status === DocumentStatus.ERROR).map((d) => d.id);
    const skipped = docs.filter((d) => d.status !== DocumentStatus.DRAFT && d.status !== DocumentStatus.ERROR).map((d) => d.id);
    if (deletable.length > 0) await this.prisma.client.document.deleteMany({ where: { id: { in: deletable } } });
    return { deleted: deletable.length, skipped };
  }
}
