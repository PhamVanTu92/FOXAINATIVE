# Build context: monorepo root
# docker build -f apps/web-portal/Dockerfile -t foxai-web-portal \
#   --build-arg NEXT_PUBLIC_API_URL=http://<server-ip>:3001 .

FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# Layer 1: workspace manifests (cache-friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web-portal/package.json apps/web-portal/
COPY packages/shared-types/package.json packages/shared-types/

# Layer 2: install all deps
RUN pnpm install --frozen-lockfile

# Layer 3: source code
COPY apps/web-portal apps/web-portal
COPY packages/shared-types packages/shared-types

# Layer 4: build shared deps first
RUN pnpm -C packages/shared-types run build

# NEXT_PUBLIC_* vars are embedded at build time — pass via --build-arg.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm -C apps/web-portal run build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone output is self-contained (includes traced node_modules).
# outputFileTracingRoot is monorepo root, so server.js lives at apps/web-portal/server.js.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-portal/.next/static ./apps/web-portal/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-portal/public ./apps/web-portal/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web-portal/server.js"]
