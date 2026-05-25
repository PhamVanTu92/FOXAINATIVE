import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DocumentStatus, Prisma, ocrPrisma } from '@foxai/ocr-db';
import type { OcrJobPayload } from '@foxai/shared-types';
import { QUEUE_NAMES } from '@foxai/shared-types';
import { IOcrProvider, OCR_PROVIDER } from '../providers/ocr.provider';

@Processor(QUEUE_NAMES.OCR, { concurrency: Number(process.env['WORKER_CONCURRENCY'] ?? 3) })
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(@Inject(OCR_PROVIDER) private readonly ocr: IOcrProvider) {
    super();
  }

  async process(job: Job<OcrJobPayload>): Promise<{ ok: true }> {
    const { documentId, schemaId, fileUrl, mimeType, language } = job.data;
    this.logger.log(`⚙️  OCR job ${job.id} → document ${documentId}`);

    try {
      await job.updateProgress(10);
      const schema = await ocrPrisma.documentSchema.findUniqueOrThrow({
        where: { id: schemaId },
        include: { fields: true },
      });
      await job.updateProgress(20);

      const result = await this.ocr.scan({
        documentId, schemaId, fileUrl, mimeType, language,
        schemaFields: schema.fields.map(f => ({
          fieldKey: f.fieldKey, label: f.label, dataType: f.dataType,
          description: (f as { description?: string | null }).description ?? null,
        })),
      });
      await job.updateProgress(70);

      const fieldKeyToId = new Map(schema.fields.map((f) => [f.fieldKey, f.id]));
      const denorm: Record<string, string | undefined> = {};

      await ocrPrisma.$transaction(async (tx) => {
        await tx.documentValue.deleteMany({ where: { documentId, isManuallyEdited: false } });
        await tx.documentLineItem.deleteMany({ where: { documentId, isManuallyAdded: false } });

        for (const f of result.fields) {
          const fieldId = fieldKeyToId.get(f.fieldKey);
          if (!fieldId) continue;
          denorm[f.fieldKey] = f.value;
          await tx.documentValue.upsert({
            where: { documentId_fieldId: { documentId, fieldId } },
            update: { stringValue: f.value, confidence: f.confidence, bboxX: f.bbox?.x, bboxY: f.bbox?.y, bboxWidth: f.bbox?.width, bboxHeight: f.bbox?.height, pageNumber: f.bbox?.page, isManuallyEdited: false },
            create: { documentId, fieldId, stringValue: f.value, confidence: f.confidence, bboxX: f.bbox?.x, bboxY: f.bbox?.y, bboxWidth: f.bbox?.width, bboxHeight: f.bbox?.height, pageNumber: f.bbox?.page },
          });
        }

        for (const li of result.lineItems) {
          await tx.documentLineItem.create({
            data: { documentId, stt: li.stt, tableKey: li.tableKey ?? null, name: li.name, unit: li.unit, quantity: li.quantity, unitPrice: li.unitPrice, amount: li.amount, extraData: li.extraData as object | undefined, isManuallyAdded: false },
          });
        }

        await tx.document.update({
          where: { id: documentId },
          data: {
            invoiceNumber: denorm['invoiceNumber'] || null,
            issueDate: denorm['issueDate'] ? parseDate(denorm['issueDate']) : null,
            sellerTaxCode: denorm['sellerTaxCode'] || null,
            sellerName: denorm['sellerName'] || null,
            totalAmount: toDecimal(denorm['totalAmount']),
            vatAmount: toDecimal(denorm['vatAmount']),
            grandTotal: toDecimal(denorm['grandTotal']),
            ocrConfidence: result.confidence,
            ocrEngineVersion: result.engineVersion,
            status: DocumentStatus.PROCESSED,
            ocrError: null,
          },
        });

        await tx.documentAuditLog.create({
          data: { documentId, action: 'OCR_COMPLETE', changedBy: 'system', note: `AI quét xong với độ tin cậy ${(result.confidence * 100).toFixed(1)}%.` },
        });
      });

      await job.updateProgress(100);
      this.logger.log(`✅ Hoàn tất OCR cho document ${documentId}`);
      return { ok: true };
    } catch (err) {
      const isDup = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      const message = isDup ? 'Hóa đơn đã tồn tại (MST + số hóa đơn trùng).' : err instanceof Error ? err.message : String(err);
      this.logger.error(`❌ Lỗi OCR document ${documentId}: ${message}`);
      await ocrPrisma.document.update({ where: { id: documentId }, data: { status: DocumentStatus.ERROR, ocrError: message } });
      if (isDup) return { ok: true };
      throw err;
    }
  }
}

function parseDate(raw: string): Date | null {
  const dm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (dm) return new Date(`${dm[3]}-${dm[2]}-${dm[1]}`);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function toDecimal(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}
