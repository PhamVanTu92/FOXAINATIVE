#!/bin/bash
# Switch sang local dev mode: tắt app containers, giữ infrastructure
echo "⏹  Stopping application containers..."
docker compose stop api-gateway system-service knowledge-service ocr-api ocr-worker web-portal 2>/dev/null

echo "✅ Infrastructure (DB, Redis) vẫn chạy"
echo "🚀 Run: pnpm dev"
