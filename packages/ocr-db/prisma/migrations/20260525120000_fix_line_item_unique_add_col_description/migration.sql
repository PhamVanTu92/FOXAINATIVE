-- Drop unique constraint (documentId, stt) — breaks when a document has multiple OCR tables
-- (each table starts stt from 1, causing duplicate (documentId, stt) pairs)
DROP INDEX IF EXISTS "document_line_items_documentId_stt_key";

-- Replace with a non-unique index for ordered queries per table
CREATE INDEX IF NOT EXISTS "document_line_items_documentId_tableKey_stt_idx"
  ON "document_line_items" ("documentId", "tableKey", "stt");

-- Add description column to document_table_columns
ALTER TABLE "document_table_columns" ADD COLUMN IF NOT EXISTS "description" TEXT;
