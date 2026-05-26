import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DocumentStatus, ocrPrisma } from '@foxai/ocr-db';
import type { OcrJobPayload, OcrFileRef } from '@foxai/shared-types';
import { QUEUE_NAMES } from '@foxai/shared-types';
import type { OcrResult, OcrRequest } from '@foxai/shared-types';
import { IOcrProvider, OCR_PROVIDER } from '../providers/ocr.provider';
import { MockOcrProvider } from '../providers/mock-ocr.provider';
import { LocalPdfOcrProvider } from '../providers/local-pdf-ocr.provider';
import { ClaudeOcrProvider } from '../providers/claude-ocr.provider';
import { GeminiOcrProvider } from '../providers/gemini-ocr.provider';

@Processor(QUEUE_NAMES.OCR, { concurrency: Number(process.env['WORKER_CONCURRENCY'] ?? 3) })
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    @Inject(OCR_PROVIDER) private readonly defaultOcr: IOcrProvider,
    private readonly mockOcr: MockOcrProvider,
    private readonly localPdfOcr: LocalPdfOcrProvider,
    private readonly claudeOcr: ClaudeOcrProvider,
    private readonly geminiOcr: GeminiOcrProvider,
  ) {
    super();
  }

  private resolveProvider(name?: string): IOcrProvider {
    switch (name) {
      case 'gemini':    return this.geminiOcr;
      case 'claude':    return this.claudeOcr;
      case 'local-pdf': return this.localPdfOcr;
      case 'mock':      return this.mockOcr;
      default:          return this.defaultOcr;
    }
  }

  async process(job: Job<OcrJobPayload>): Promise<{ ok: true }> {
    const { documentId, schemaId, fileUrl, mimeType, language, ocrProvider, extraFileUrls } = job.data;
    const ocr = this.resolveProvider(ocrProvider);
    this.logger.log(`⚙️  OCR job ${job.id} → document ${documentId}`);

    try {
      await job.updateProgress(10);
      const schema = await ocrPrisma.documentSchema.findUniqueOrThrow({
        where: { id: schemaId },
        include: { fields: true, tables: { include: { columns: true }, orderBy: { displayOrder: 'asc' } } },
      });
      await job.updateProgress(20);

      const baseRequest: Omit<OcrRequest, 'fileUrl' | 'mimeType'> = {
        documentId, schemaId, language,
        promptTemplate: schema.description ?? null,
        schemaFields: schema.fields.map(f => ({
          fieldKey: f.fieldKey, label: f.label, dataType: f.dataType,
          description: (f as { description?: string | null }).description ?? null,
        })),
        schemaTables: schema.tables.map(t => ({
          tableKey: t.tableKey,
          name: t.name,
          columns: t.columns.map(c => ({ columnKey: c.columnKey, label: c.label, dataType: c.dataType })),
        })),
      };

      // Build list of all files to scan (primary + extras)
      const allFiles: OcrFileRef[] = [
        { url: fileUrl, mimeType },
        ...(extraFileUrls ?? []),
      ];

      this.logger.log(`🔌 Provider: ${ocr.name}${ocrProvider ? ` (per-job override)` : ` (server default)`} | ${allFiles.length} file(s)`);

      // Scan each file, then merge results
      const progressPerFile = 45 / allFiles.length;
      const results: OcrResult[] = [];
      for (let i = 0; i < allFiles.length; i++) {
        const f = allFiles[i]!;
        const r = await ocr.scan({ ...baseRequest, fileUrl: f.url, mimeType: f.mimeType });
        results.push(r);
        await job.updateProgress(20 + Math.round(progressPerFile * (i + 1)));
      }

      const result = mergeOcrResults(results);
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
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`❌ Lỗi OCR document ${documentId}: ${message}`);
      await ocrPrisma.document.update({ where: { id: documentId }, data: { status: DocumentStatus.ERROR, ocrError: message } });
      throw err;
    }
  }
}

function mergeOcrResults(results: OcrResult[]): OcrResult {
  if (results.length === 1) return results[0]!;

  // For each fieldKey, keep the value with the highest confidence
  const fieldMap = new Map<string, OcrResult['fields'][0]>();
  for (const r of results) {
    for (const f of r.fields) {
      const existing = fieldMap.get(f.fieldKey);
      if (!existing || (!existing.value && f.value) || (f.value && f.confidence > existing.confidence)) {
        fieldMap.set(f.fieldKey, f);
      }
    }
  }

  // Concatenate all lineItems, re-numbering stt
  let sttCounter = 1;
  const lineItems: OcrResult['lineItems'] = [];
  for (const r of results) {
    for (const li of r.lineItems) {
      lineItems.push({ ...li, stt: sttCounter++ });
    }
  }

  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;

  return {
    confidence: avgConfidence,
    language: results[0]!.language,
    engineVersion: results[0]!.engineVersion,
    fields: Array.from(fieldMap.values()),
    lineItems,
  };
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
