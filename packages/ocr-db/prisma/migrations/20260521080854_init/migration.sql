-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'RECEIPT', 'CONTRACT', 'STATEMENT', 'MINUTES', 'WAREHOUSE_RECEIPT', 'OTHERS');

-- CreateEnum
CREATE TYPE "FieldDataType" AS ENUM ('TEXT', 'DATE', 'NUMBER', 'CURRENCY', 'BOOLEAN', 'LIST');

-- CreateEnum
CREATE TYPE "FieldPosition" AS ENUM ('HEADER', 'FOOTER', 'BODY');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCESSED', 'ERROR');

-- CreateTable
CREATE TABLE "document_schemas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_fields" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" "FieldDataType" NOT NULL,
    "position" "FieldPosition" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "validationRegex" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_tables" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_table_columns" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "columnKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" "FieldDataType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_table_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "schemaCode" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "invoiceNumber" TEXT,
    "issueDate" DATE,
    "sellerTaxCode" TEXT,
    "sellerName" TEXT,
    "totalAmount" DECIMAL(18,2),
    "vatAmount" DECIMAL(18,2),
    "grandTotal" DECIMAL(18,2),
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "ocrConfidence" DOUBLE PRECISION,
    "ocrLanguage" TEXT,
    "ocrEngineVersion" TEXT,
    "ocrError" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_values" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "stringValue" TEXT,
    "bboxX" DOUBLE PRECISION,
    "bboxY" DOUBLE PRECISION,
    "bboxWidth" DOUBLE PRECISION,
    "bboxHeight" DOUBLE PRECISION,
    "pageNumber" INTEGER,
    "confidence" DOUBLE PRECISION,
    "isManuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_line_items" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "stt" INTEGER NOT NULL,
    "name" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(18,4),
    "unitPrice" DECIMAL(18,2),
    "amount" DECIMAL(18,2),
    "extraData" JSONB,
    "isManuallyAdded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_audit_logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "oldStatus" "DocumentStatus",
    "newStatus" "DocumentStatus",
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "document_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_schemas_code_key" ON "document_schemas"("code");

-- CreateIndex
CREATE INDEX "document_schemas_type_idx" ON "document_schemas"("type");

-- CreateIndex
CREATE INDEX "document_schemas_isActive_idx" ON "document_schemas"("isActive");

-- CreateIndex
CREATE INDEX "document_fields_schemaId_idx" ON "document_fields"("schemaId");

-- CreateIndex
CREATE INDEX "document_fields_position_idx" ON "document_fields"("position");

-- CreateIndex
CREATE UNIQUE INDEX "document_fields_schemaId_fieldKey_key" ON "document_fields"("schemaId", "fieldKey");

-- CreateIndex
CREATE INDEX "document_tables_schemaId_idx" ON "document_tables"("schemaId");

-- CreateIndex
CREATE UNIQUE INDEX "document_tables_schemaId_tableKey_key" ON "document_tables"("schemaId", "tableKey");

-- CreateIndex
CREATE INDEX "document_table_columns_tableId_idx" ON "document_table_columns"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "document_table_columns_tableId_columnKey_key" ON "document_table_columns"("tableId", "columnKey");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");

-- CreateIndex
CREATE INDEX "documents_schemaCode_idx" ON "documents"("schemaCode");

-- CreateIndex
CREATE INDEX "documents_invoiceNumber_idx" ON "documents"("invoiceNumber");

-- CreateIndex
CREATE INDEX "documents_sellerTaxCode_idx" ON "documents"("sellerTaxCode");

-- CreateIndex
CREATE INDEX "documents_issueDate_idx" ON "documents"("issueDate");

-- CreateIndex
CREATE INDEX "documents_schemaId_status_idx" ON "documents"("schemaId", "status");

-- CreateIndex
CREATE INDEX "documents_status_createdAt_idx" ON "documents"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "documents_sellerTaxCode_invoiceNumber_key" ON "documents"("sellerTaxCode", "invoiceNumber");

-- CreateIndex
CREATE INDEX "document_values_documentId_idx" ON "document_values"("documentId");

-- CreateIndex
CREATE INDEX "document_values_fieldId_idx" ON "document_values"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "document_values_documentId_fieldId_key" ON "document_values"("documentId", "fieldId");

-- CreateIndex
CREATE INDEX "document_line_items_documentId_idx" ON "document_line_items"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_line_items_documentId_stt_key" ON "document_line_items"("documentId", "stt");

-- CreateIndex
CREATE INDEX "document_audit_logs_documentId_idx" ON "document_audit_logs"("documentId");

-- CreateIndex
CREATE INDEX "document_audit_logs_changedAt_idx" ON "document_audit_logs"("changedAt" DESC);

-- CreateIndex
CREATE INDEX "document_audit_logs_changedBy_idx" ON "document_audit_logs"("changedBy");

-- CreateIndex
CREATE INDEX "document_audit_logs_action_idx" ON "document_audit_logs"("action");

-- AddForeignKey
ALTER TABLE "document_fields" ADD CONSTRAINT "document_fields_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "document_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tables" ADD CONSTRAINT "document_tables_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "document_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_table_columns" ADD CONSTRAINT "document_table_columns_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "document_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "document_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_values" ADD CONSTRAINT "document_values_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_values" ADD CONSTRAINT "document_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "document_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_line_items" ADD CONSTRAINT "document_line_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
