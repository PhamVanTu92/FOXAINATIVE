# Build context: monorepo root
# docker build -f apps/chatbot-service/Dockerfile -t foxai-chatbot-service .

FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# Layer 1: workspace manifests (cache-friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/chatbot-service/package.json apps/chatbot-service/
COPY packages/chatbot-db/package.json packages/chatbot-db/
COPY packages/shared-types/package.json packages/shared-types/

# Layer 2: install all deps
RUN pnpm install --frozen-lockfile

# Layer 3: source code
COPY apps/chatbot-service apps/chatbot-service
COPY packages/chatbot-db packages/chatbot-db
COPY packages/shared-types packages/shared-types

# Layer 4: build in dependency order
RUN find . -name "*.tsbuildinfo" -delete
RUN pnpm -C packages/shared-types run build
# prisma generate phải chạy trước khi build chatbot-db vì nó tạo ra .prisma/chatbot-client types
RUN cd packages/chatbot-db && npx prisma generate
RUN pnpm -C packages/chatbot-db run build
RUN pnpm -C apps/chatbot-service run build \
    && ls /app/apps/chatbot-service/dist/main.js \
    || (echo "ERROR: nest build did not produce dist/" && exit 1)

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/chatbot-service/package.json apps/chatbot-service/
COPY packages/chatbot-db/package.json packages/chatbot-db/
COPY packages/shared-types/package.json packages/shared-types/

RUN pnpm install --frozen-lockfile --prod

# Built artifacts
COPY --from=builder /app/apps/chatbot-service/dist apps/chatbot-service/dist
COPY --from=builder /app/packages/chatbot-db/dist packages/chatbot-db/dist
COPY --from=builder /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=builder /app/packages/chatbot-db/prisma packages/chatbot-db/prisma

# Copy Prisma generated client — nằm ở packages/chatbot-db/node_modules/.prisma/chatbot-client
COPY --from=builder /app/packages/chatbot-db/node_modules/.prisma packages/chatbot-db/node_modules/.prisma

# pnpm virtual store
COPY --from=builder /app/node_modules/.pnpm node_modules/.pnpm
COPY --from=builder /app/node_modules/.modules.yaml node_modules/.modules.yaml

WORKDIR /app/apps/chatbot-service

ENV NODE_ENV=production

EXPOSE 3004

CMD ["node", "dist/main.js"]
