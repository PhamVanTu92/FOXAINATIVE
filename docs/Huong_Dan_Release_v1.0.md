# Hướng Dẫn Đóng Gói & Release FOXAI Native v1.0

> **Phiên bản tài liệu:** 1.0  
> **Áp dụng cho:** FOXAI Native Monorepo  
> **Stack:** NestJS · .NET 9 · Python/FastAPI · Next.js · Docker Compose

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Yêu cầu môi trường](#2-yêu-cầu-môi-trường)
3. [Checklist trước khi release](#3-checklist-trước-khi-release)
4. [Bước 1 – Cập nhật version](#bước-1--cập-nhật-version)
5. [Bước 2 – Kiểm tra code quality](#bước-2--kiểm-tra-code-quality)
6. [Bước 3 – Cấu hình môi trường Production](#bước-3--cấu-hình-môi-trường-production)
7. [Bước 4 – Build Docker images](#bước-4--build-docker-images)
8. [Bước 5 – Chạy Database Migrations](#bước-5--chạy-database-migrations)
9. [Bước 6 – Khởi động stack Production](#bước-6--khởi-động-stack-production)
10. [Bước 7 – Kiểm tra sau deploy](#bước-7--kiểm-tra-sau-deploy)
11. [Bước 8 – Git tag & Release](#bước-8--git-tag--release)
12. [Kế hoạch Rollback](#kế-hoạch-rollback)
13. [Biến môi trường – Tham chiếu đầy đủ](#biến-môi-trường--tham-chiếu-đầy-đủ)

---

## 1. Tổng quan kiến trúc

```
Internet
    │
    ▼
 Nginx (reverse proxy / SSL termination)
    │
    ├──► web-portal      (Next.js  · port 8082)
    └──► api-gateway     (NestJS   · port 3001)
              │
              ├──► system-service    (.NET 9 gRPC · port 3002/50051)
              ├──► knowledge-service (.NET 9 gRPC · port 3005/50052)
              ├──► ocr-api           (NestJS      · port 3003)
              ├──► chatbot-service   (FastAPI      · port 3004)
              └──► index-service     (FastAPI      · port 3006)

Databases (internal network):
  system-db      PostgreSQL 16
  ocr-db         PostgreSQL 16 + pgvector
  chatbot-db     PostgreSQL 16 + pgvector
  knowledge-db   PostgreSQL 16
  index-db       PostgreSQL 17

Services hỗ trợ:
  Redis          BullMQ queue
  Qdrant         Vector database (RAG + Mem0)
  MinIO          Object storage (file upload)
```

---

## 2. Yêu cầu môi trường

| Thành phần | Phiên bản tối thiểu |
|---|---|
| Docker | 24.x+ |
| Docker Compose | v2.20+ |
| Node.js (build local) | 20.x+ |
| pnpm | 8.x+ |
| .NET SDK (build local) | 9.x |
| Python | 3.11+ |
| OpenSSL | bất kỳ (tạo JWT secret) |

> **Lưu ý:** Trên server production, chỉ cần Docker + Docker Compose. Không cần cài Node, .NET hay Python vì tất cả build trong container.

---

## 3. Checklist trước khi release

Đánh dấu từng mục trước khi thực hiện deploy:

- [ ] Tất cả tính năng trong phạm vi v1.0 đã hoàn thành
- [ ] Không còn bug P0/P1 mở
- [ ] `pnpm lint` — không có lỗi
- [ ] `pnpm typecheck` — không có lỗi TypeScript
- [ ] `pnpm build` — build thành công toàn bộ packages
- [ ] Tất cả migrations database đã được tạo và kiểm tra
- [ ] File `.env` production đã được điền đầy đủ (không còn `CHANGE_ME_`)
- [ ] `JWT_SECRET` được tạo bằng `openssl rand -hex 32`
- [ ] API keys thực tế đã điền (Gemini, OpenAI, FoxAI LLM)
- [ ] `NEXT_PUBLIC_API_URL` trỏ đúng domain production
- [ ] Backup database (nếu upgrade từ bản cũ)
- [ ] Nginx config đã cập nhật đúng domain
- [ ] Git branch `main` đã nhận đủ code từ `hientv-uat`

---

## Bước 1 – Cập nhật version

### 1.1 Root package.json

Mở [package.json](../package.json), đổi:

```json
{
  "version": "1.0.0"
}
```

### 1.2 Các app NestJS / Next.js

Chạy lệnh sau để cập nhật tất cả cùng lúc:

```powershell
# Windows PowerShell
$files = @(
  "apps/api-gateway/package.json",
  "apps/ocr-service/package.json",
  "apps/web-portal/package.json"
)
foreach ($f in $files) {
  $content = Get-Content $f -Raw | ConvertFrom-Json
  $content.version = "1.0.0"
  $content | ConvertTo-Json -Depth 10 | Set-Content $f -Encoding utf8
}
```

### 1.3 .NET Services

Mở file `.csproj` của từng service và cập nhật:

```xml
<!-- apps/system-service/src/SystemService.Api/SystemService.Api.csproj -->
<PropertyGroup>
  <Version>1.0.0</Version>
  <AssemblyVersion>1.0.0.0</AssemblyVersion>
</PropertyGroup>

<!-- apps/knowledge-service/... (tương tự) -->
```

### 1.4 Python Services

Nếu có `pyproject.toml`:

```toml
# apps/chatbot-service/pyproject.toml
[tool.poetry]
version = "1.0.0"

# apps/index-service/pyproject.toml (tương tự)
```

---

## Bước 2 – Kiểm tra code quality

Chạy toàn bộ trên máy dev trước khi deploy:

```bash
# 1. Lint
pnpm lint

# 2. TypeScript type-check
pnpm typecheck

# 3. Build tất cả packages
pnpm build

# 4. Chạy tests
pnpm test
```

Nếu có lỗi, **không tiếp tục** cho đến khi tất cả pass.

---

## Bước 3 – Cấu hình môi trường Production

### 3.1 Tạo file `.env` từ template

```bash
cp .env.production.example .env
```

### 3.2 Điền giá trị thực tế

Mở `.env` và điền tất cả biến (xem [Tham chiếu đầy đủ](#biến-môi-trường--tham-chiếu-đầy-đủ) ở cuối tài liệu):

```bash
# Tạo JWT_SECRET an toàn
openssl rand -hex 32
```

### 3.3 Kiểm tra không còn placeholder

```bash
grep "CHANGE_ME" .env
# Phải không có kết quả nào
```

### 3.4 Cấu hình chatbot-service và index-service

Hai service Python đọc thêm file `.env` riêng:

```bash
# Kiểm tra file env tồn tại
ls apps/chatbot-service/.env
ls apps/index-service/.env
```

Nếu chưa có, tạo từ mẫu trong thư mục tương ứng và điền đầy đủ.

---

## Bước 4 – Build Docker images

### 4.1 Build toàn bộ

```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

Hoặc build từng service riêng để debug:

```bash
docker compose -f docker-compose.prod.yml build system-service
docker compose -f docker-compose.prod.yml build knowledge-service
docker compose -f docker-compose.prod.yml build ocr-api
docker compose -f docker-compose.prod.yml build chatbot-service
docker compose -f docker-compose.prod.yml build index-service
docker compose -f docker-compose.prod.yml build api-gateway
docker compose -f docker-compose.prod.yml build web-portal
```

### 4.2 Tag images với version

```bash
docker tag foxai-system-service:latest    foxai-system-service:1.0.0
docker tag foxai-knowledge-service:latest foxai-knowledge-service:1.0.0
docker tag foxai-ocr-service:latest       foxai-ocr-service:1.0.0
docker tag foxai-chatbot-service:latest   foxai-chatbot-service:1.0.0
docker tag foxai-index-service:latest     foxai-index-service:1.0.0
docker tag foxai-api-gateway:latest       foxai-api-gateway:1.0.0
docker tag foxai-web-portal:latest        foxai-web-portal:1.0.0
```

---

## Bước 5 – Chạy Database Migrations

> **Quan trọng:** Thực hiện bước này **trước khi** khởi động toàn bộ stack.

### 5.1 Khởi động databases trước

```bash
docker compose -f docker-compose.prod.yml up -d \
  system-db ocr-db chatbot-db knowledge-db index-db
```

Đợi healthy:

```bash
docker compose -f docker-compose.prod.yml ps
# Chờ tất cả DB ở trạng thái "healthy"
```

### 5.2 Chạy migration .NET (system-service & knowledge-service tự migrate khi start)

Hai service .NET có `SYSTEM_SERVICE_AUTOMIGRATE: 'true'` — migration sẽ tự chạy khi container khởi động. Không cần thêm bước thủ công.

### 5.3 Chạy migration Python (index-service)

```bash
docker compose -f docker-compose.prod.yml run --rm index-py-migration
```

### 5.4 Kiểm tra migration thành công

```bash
# Xem log migration
docker compose -f docker-compose.prod.yml logs index-py-migration
# Phải có dòng "INFO  [alembic.runtime.migration] Running upgrade ..."
```

---

## Bước 6 – Khởi động stack Production

### 6.1 Khởi động theo thứ tự

```bash
# Khởi động toàn bộ stack
docker compose -f docker-compose.prod.yml up -d
```

Hoặc khởi động theo tầng (an toàn hơn khi lần đầu deploy):

```bash
# Tầng 1: Databases + Redis + MinIO + Qdrant
docker compose -f docker-compose.prod.yml up -d \
  system-db ocr-db chatbot-db knowledge-db index-db \
  redis minio qdrant

# Đợi healthy (~30 giây)
docker compose -f docker-compose.prod.yml ps

# Tầng 2: Migrations
docker compose -f docker-compose.prod.yml up -d index-py-migration

# Tầng 3: Backend services
docker compose -f docker-compose.prod.yml up -d \
  system-service knowledge-service ocr-api chatbot-service index-service

# Tầng 4: OCR workers
docker compose -f docker-compose.prod.yml up -d ocr-worker

# Tầng 5: API Gateway + Web Portal
docker compose -f docker-compose.prod.yml up -d api-gateway web-portal
```

### 6.2 Xem logs realtime

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=50
```

---

## Bước 7 – Kiểm tra sau deploy

### 7.1 Kiểm tra tất cả containers đang chạy

```bash
docker compose -f docker-compose.prod.yml ps
```

Tất cả service phải ở trạng thái **`running`** (không phải `exited` hay `restarting`).

### 7.2 Health check các service

```bash
# API Gateway
curl http://localhost:3001/health

# System Service
curl http://localhost:3002/health

# Knowledge Service
curl http://localhost:3005/health

# OCR Service
curl http://localhost:3003/health
```

Kết quả mong đợi:
```json
{"status": "ok"}
```

### 7.3 Kiểm tra Web Portal

Mở browser: `http://your-domain.com` (hoặc `http://localhost:8082` nếu test local)

### 7.4 Smoke test API

```bash
# Thử login (thay đúng domain)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_admin_password"}'
```

### 7.5 Kiểm tra MinIO Console

Mở browser: `http://your-domain.com:9001`  
Đăng nhập bằng `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`

### 7.6 Kiểm tra Qdrant

```bash
curl http://localhost:6333/collections
```

---

## Bước 8 – Git tag & Release

### 8.1 Merge vào main

```bash
git checkout main
git pull origin main
git merge hientv-uat --no-ff -m "chore: merge hientv-uat into main for v1.0.0 release"
```

### 8.2 Commit version bump

```bash
git add package.json apps/*/package.json packages/*/package.json
git commit -m "chore: bump version to 1.0.0"
```

### 8.3 Tạo tag release

```bash
git tag -a v1.0.0 -m "Release v1.0.0

Tính năng chính:
- OCR nhận dạng chứng từ tự động
- Chatbot RAG với kiến thức doanh nghiệp
- Quản lý tri thức (Knowledge Base)
- Hệ thống phân quyền (System Service)
- API Gateway tập trung
- Web Portal (Next.js)
"

git push origin main
git push origin v1.0.0
```

### 8.4 Tạo Release trên GitHub/GitLab (tuỳ chọn)

```bash
gh release create v1.0.0 \
  --title "FOXAI Native v1.0.0" \
  --notes-file docs/CHANGELOG.md
```

---

## Kế hoạch Rollback

Nếu phát hiện lỗi nghiêm trọng sau khi release:

### Rollback Docker (nhanh nhất)

```bash
# Dừng stack hiện tại
docker compose -f docker-compose.prod.yml down

# Khởi động lại với image version cũ (ví dụ 0.9.x)
# Đổi tag trong docker-compose.prod.yml hoặc dùng lệnh trực tiếp:
docker run -d --name foxai-api-gateway foxai-api-gateway:0.9.x
```

### Rollback database

> **Phải thực hiện trước khi rollback code** nếu có migration mới.

```bash
# .NET services — rollback migration
dotnet ef database update <PreviousMigrationName> \
  --project apps/system-service/src/SystemService.Infrastructure \
  --startup-project apps/system-service/src/SystemService.Api

# Python (index-service) — rollback alembic
docker compose -f docker-compose.prod.yml run --rm index-py-migration \
  alembic downgrade -1
```

### Rollback Git

```bash
git revert v1.0.0
git push origin main
```

---

## Biến môi trường – Tham chiếu đầy đủ

Tạo file `.env` trên server production với đầy đủ các biến sau:

```bash
# ─── System DB ──────────────────────────────────────────────
SYSTEM_DB_USER=foxai_system
SYSTEM_DB_PASSWORD=<mật_khẩu_mạnh_1>
SYSTEM_DB_NAME=system_db

# ─── OCR DB ─────────────────────────────────────────────────
OCR_DB_USER=foxai_ocr
OCR_DB_PASSWORD=<mật_khẩu_mạnh_2>
OCR_DB_NAME=ocr_db

# ─── Chatbot DB ─────────────────────────────────────────────
CHATBOT_DB_USER=foxai_chatbot
CHATBOT_DB_PASSWORD=<mật_khẩu_mạnh_3>
CHATBOT_DB_NAME=chatbot_db

# ─── Knowledge DB ───────────────────────────────────────────
KNOWLEDGE_DB_USER=foxai_kb
KNOWLEDGE_DB_PASSWORD=<mật_khẩu_mạnh_4>
KNOWLEDGE_DB_NAME=knowledge_db

# ─── Index DB ───────────────────────────────────────────────
INDEX_DB_USER=postgres
INDEX_DB_PASSWORD=<mật_khẩu_mạnh_5>
INDEX_DB_NAME=index_py_db

# ─── Redis ───────────────────────────────────────────────────
REDIS_HOST=host.docker.internal   # hoặc IP Redis server
REDIS_PORT=6379
REDIS_PASSWORD=                   # điền nếu Redis có auth

# ─── JWT ─────────────────────────────────────────────────────
# Tạo: openssl rand -hex 32
JWT_SECRET=<64_ký_tự_hex_ngẫu_nhiên>
JWT_EXPIRES_IN=7d

# ─── OCR Provider ────────────────────────────────────────────
OCR_PROVIDER=gemini               # gemini | mock | google-document-ai
GEMINI_API_KEY=<your_gemini_key>

# ─── LLM / Embedding ─────────────────────────────────────────
OPENAI_API_KEY=<your_openai_key>
CLAUDE_API_KEY=                   # để trống nếu không dùng

# ─── FoxAI LLM ───────────────────────────────────────────────
FOXAILLM_API_KEY=<foxaillm_api_key>
FOXAILLM_BASE_URL=<foxaillm_base_url>

# ─── BullMQ ──────────────────────────────────────────────────
BULLMQ_PREFIX=foxai
WORKER_CONCURRENCY=30

# ─── MinIO ───────────────────────────────────────────────────
MINIO_ROOT_USER=minio_prod
MINIO_ROOT_PASSWORD=<mật_khẩu_minio>
MINIO_HOST=minio:9000             # nội bộ docker
MINIO_PUBLIC_URL_BASE=https://your-domain.com/minio   # URL public

# ─── Qdrant ──────────────────────────────────────────────────
QDRANT_HOST=http://qdrant:6333
QDRANT_COLLECTION_NAME=foxai
QDRANT_API_KEY=                   # để trống nếu không có auth

# ─── Inter-service URLs ───────────────────────────────────────
AUTH_SERVICE_URL=http://system-service:3002
INDEX_SERVICE_URL=http://index-service:8000
QUERY_SERVICE_URL=http://chatbot-service:8000

# ─── Public URL & CORS ───────────────────────────────────────
# NEXT_PUBLIC_API_URL bake vào lúc build Next.js — phải đúng domain
NEXT_PUBLIC_API_URL=https://your-domain.com
PUBLIC_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

# ─── Misc ────────────────────────────────────────────────────
NODE_ENV=production
LOG_LEVEL=info
```

---

## Lệnh hữu ích

```bash
# Xem logs tất cả services
docker compose -f docker-compose.prod.yml logs -f

# Xem logs service cụ thể
docker compose -f docker-compose.prod.yml logs -f api-gateway

# Restart một service
docker compose -f docker-compose.prod.yml restart chatbot-service

# Xem resource usage
docker stats

# Vào shell của container
docker exec -it foxai-api-gateway sh

# Dừng toàn bộ stack (giữ data)
docker compose -f docker-compose.prod.yml down

# Dừng và xóa volumes (MẤT DATA — chỉ dùng khi reset hoàn toàn)
docker compose -f docker-compose.prod.yml down -v
```

---

*Tài liệu này được tạo cho FOXAI Native Monorepo — phiên bản 1.0.0*
