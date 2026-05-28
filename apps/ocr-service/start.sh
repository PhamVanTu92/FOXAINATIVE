#!/bin/sh
set -e

PRISMA_BIN="/app/node_modules/.pnpm/node_modules/.bin/prisma"
SCHEMA="/app/packages/ocr-db/prisma/schema.prisma"

echo "[migrate] Running Prisma migrations..."
"$PRISMA_BIN" migrate deploy --schema="$SCHEMA"
echo "[migrate] Done."

exec node dist/main.js
