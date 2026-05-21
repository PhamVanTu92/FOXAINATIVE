-- ============================================================================
-- PostgreSQL Initialization Script
-- Enable required extensions for AI OCR Document Management System
-- ============================================================================

-- pgvector: Vector embedding storage for semantic search (Knowledge Base)
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm: Trigram-based fuzzy text search (for "Universal Search" feature)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extensions
DO $$
BEGIN
  RAISE NOTICE 'pgvector version: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
  RAISE NOTICE 'pg_trgm version: %', (SELECT extversion FROM pg_extension WHERE extname = 'pg_trgm');
END $$;
