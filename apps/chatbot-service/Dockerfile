# Build context: monorepo root
# docker build -f apps/chatbot-service/Dockerfile -t foxai-chatbot-service .

FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# Layer 1: workspace manifests (cache-friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
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
RUN pnpm -C packages/shared-types run build
RUN pnpm -C packages/chatbot-db run build
# prisma generate does not need a real DB — reads schema.prisma only
RUN cd packages/chatbot-db && npx prisma generate
RUN pnpm -C apps/chatbot-service run build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

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

# pnpm virtual store for runtime deps
COPY --from=builder /app/node_modules/.pnpm node_modules/.pnpm
COPY --from=builder /app/node_modules/.modules.yaml node_modules/.modules.yaml

WORKDIR /app/apps/chatbot-service

ENV NODE_ENV=production

EXPOSE 3004

CMD ["node", "dist/main.js"]
