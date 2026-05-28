# Build context: monorepo root
# docker build -f apps/api-gateway/Dockerfile -t foxai-api-gateway .

FROM node:20-alpine AS builder

# protoc required for shared-proto gen:ts step
RUN apk add --no-cache protobuf

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# Layer 1: workspace manifests (cache-friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api-gateway/package.json apps/api-gateway/
COPY packages/shared-proto/package.json packages/shared-proto/
COPY packages/shared-types/package.json packages/shared-types/

# Layer 2: install all deps
RUN pnpm install --frozen-lockfile

# Layer 3: source code
COPY apps/api-gateway apps/api-gateway
COPY packages/shared-proto packages/shared-proto
COPY packages/shared-types packages/shared-types

# Layer 4: build in dependency order
# shared-types/tsconfig.json extends ../../tsconfig.base.json — the
# base must exist or TS silently falls back to defaults (losing
# experimentalDecorators → class-validator/transformer crash).
RUN pnpm -C packages/shared-types run build
RUN pnpm -C apps/api-gateway run build \
    && ls /app/apps/api-gateway/dist/main.js \
    || (echo "ERROR: nest build did not produce dist/" && exit 1)

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api-gateway/package.json apps/api-gateway/
COPY packages/shared-proto/package.json packages/shared-proto/
COPY packages/shared-types/package.json packages/shared-types/

RUN pnpm install --frozen-lockfile --prod

# Built artifacts
COPY --from=builder /app/apps/api-gateway/dist apps/api-gateway/dist
COPY --from=builder /app/packages/shared-types/dist packages/shared-types/dist

# proto files may be loaded at runtime by @grpc/proto-loader
COPY --from=builder /app/packages/shared-proto/proto packages/shared-proto/proto
COPY --from=builder /app/packages/shared-proto/gen packages/shared-proto/gen

# pnpm virtual store for runtime deps
COPY --from=builder /app/node_modules/.pnpm node_modules/.pnpm
COPY --from=builder /app/node_modules/.modules.yaml node_modules/.modules.yaml

WORKDIR /app/apps/api-gateway

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/main.js"]
