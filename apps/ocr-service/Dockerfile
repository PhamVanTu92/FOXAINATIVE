# Build context: monorepo root
# docker build -f apps/ocr-service/Dockerfile -t foxai-ocr-service .

FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# Layer 1: workspace manifests (cache-friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ocr-service/package.json apps/ocr-service/
COPY packages/ocr-db/package.json packages/ocr-db/
COPY packages/shared-types/package.json packages/shared-types/

# Layer 2: install all deps
RUN pnpm install --frozen-lockfile

# Layer 3: source code
COPY apps/ocr-service apps/ocr-service
COPY packages/ocr-db packages/ocr-db
COPY packages/shared-types packages/shared-types

# Layer 4: build in dependency order
RUN pnpm -C packages/shared-types run build
RUN pnpm -C packages/ocr-db run build
# prisma generate does not need a real DB — reads schema.prisma only
RUN cd packages/ocr-db && npx prisma generate
RUN pnpm -C apps/ocr-service run build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ocr-service/package.json apps/ocr-service/
COPY packages/ocr-db/package.json packages/ocr-db/
COPY packages/shared-types/package.json packages/shared-types/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/apps/ocr-service/dist apps/ocr-service/dist
COPY --from=builder /app/packages/ocr-db/dist packages/ocr-db/dist
COPY --from=builder /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=builder /app/packages/ocr-db/prisma packages/ocr-db/prisma

# Copy Prisma generated client (pnpm virtual store)
COPY --from=builder /app/node_modules/.pnpm node_modules/.pnpm
COPY --from=builder /app/node_modules/.modules.yaml node_modules/.modules.yaml

WORKDIR /app/apps/ocr-service

ENV NODE_ENV=production
ENV UPLOAD_DIR=./uploads

RUN mkdir -p uploads

EXPOSE 3003

CMD ["node", "dist/main.js"]
