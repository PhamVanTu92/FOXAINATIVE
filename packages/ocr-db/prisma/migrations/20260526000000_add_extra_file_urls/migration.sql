-- Add extra_file_urls to store additional file sources for multi-file OCR documents
ALTER TABLE "documents" ADD COLUMN "extra_file_urls" JSONB;
