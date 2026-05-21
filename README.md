# FOXAINATIVE – AI OCR Document Management System

Hệ thống quản lý chứng từ tự động hóa bằng AI OCR, gồm 3 phân hệ: **Thiết lập Schema**, **Nhận dạng OCR**, **Quản lý Chứng từ**.

> **Tech stack:** pnpm Workspaces · TypeScript · NestJS · Next.js 14 · PostgreSQL + pgvector · Prisma · BullMQ · Redis · MinIO

---

## 1. Cấu trúc Monorepo

```
foxainative/
├── apps/
│   ├── web/           # Next.js Frontend (3 màn hình UI)
│   ├── backend/       # NestJS API Gateway
│   └── worker/        # NestJS Standalone (BullMQ Consumer + Mock OCR)
├── packages/
│   ├── database/      # Prisma schema + client singleton + seed
│   ├── dto/           # Shared DTOs (class-validator)
│   └── types/         # Shared TS types (OCR result, queue payload, API envelope)
├── docs/              # 5 file đặc tả nghiệp vụ & kiến trúc
├── scripts/           # init-pgvector.sql
└── docker-compose.yml # Postgres + Redis + MinIO
```

---

## 2. Yêu cầu cài đặt

| Thành phần | Phiên bản |
|---|---|
| Node.js | ≥ 20 LTS |
| pnpm | ≥ 8.0 (cài bằng `npm i -g pnpm`) |
| Docker Desktop | mới nhất |

---

## 3. Quy trình khởi động (Bootstrap)

### Bước 1 – Cài dependencies

```bash
pnpm install
```

### Bước 2 – Tạo file `.env`

```bash
cp .env.example .env
```

> Mặc định `.env` đã trỏ về cụm Docker local. Không cần sửa nếu chỉ chạy thử.

### Bước 3 – Bật hạ tầng (PostgreSQL + Redis + MinIO)

```bash
pnpm docker:up
```

Kiểm tra extension `pgvector` đã được bật:

```bash
docker exec ocr-postgres psql -U ocr_user -d ocr_db -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

### Bước 4 – Generate Prisma Client + migrate + seed

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Lệnh seed sẽ tạo schema mặc định `INVOICE-VAT-IN` với 7 trường đơn (Số HĐ, Ngày, MST, Tên người bán, Tổng tiền, VAT, Tổng thanh toán) và bảng lặp 6 cột (STT, Tên hàng, ĐVT, SL, Đơn giá, Thành tiền).

### Bước 5 – Chạy song song 3 ứng dụng

```bash
pnpm dev
```

Các service sẽ chạy tại:

| Service | URL |
|---|---|
| Web (Next.js) | http://localhost:3000 |
| Backend (NestJS) | http://localhost:3001 |
| Swagger API Docs | http://localhost:3001/api/docs |
| MinIO Console | http://localhost:9001 (user: `minio_admin` / pass: `minio_password`) |
| Prisma Studio | `pnpm db:studio` → http://localhost:5555 |

---

## 4. Luồng thử nghiệm End-to-End

1. Truy cập http://localhost:3000/schemas → thấy 1 schema `INVOICE-VAT-IN`.
2. Sang http://localhost:3000/ocr → chọn schema, chọn file bất kỳ (PDF/PNG/JPG), bấm **Quét OCR**.
3. Backend trả về HTTP 202 + `documentId` ngay tức thì. Worker pull job từ Redis, chạy mock OCR (sleep 1.5s) và ghi kết quả vào DB.
4. Sang http://localhost:3000/documents → thấy chứng từ mới với trạng thái `Nháp` và 94% confidence.

---

## 5. Lệnh thường dùng

```bash
# Dev
pnpm dev                       # Chạy song song web + backend + worker
pnpm --filter @ocr/backend dev # Chỉ chạy backend
pnpm --filter @ocr/web dev     # Chỉ chạy web

# Database
pnpm db:generate               # Generate Prisma Client
pnpm db:migrate                # Tạo + apply migration mới
pnpm db:seed                   # Seed schema mẫu
pnpm db:studio                 # Mở Prisma Studio UI

# Docker
pnpm docker:up                 # Bật Postgres + Redis + MinIO
pnpm docker:down               # Tắt
pnpm docker:logs               # Theo dõi logs

# Build & type-check
pnpm build
pnpm typecheck
```

---

## 6. Đổi sang OCR provider thật

Hệ thống đang dùng **Mock OCR Provider** (trả dữ liệu giả). Để dùng provider thật:

1. Tạo file mới trong `apps/worker/src/providers/` (vd: `google-document-ai.provider.ts`) implement interface `IOcrProvider`.
2. Đăng ký provider mới trong `apps/worker/src/worker.module.ts` thay cho `MockOcrProvider`.
3. Set biến môi trường `OCR_PROVIDER` và các API key tương ứng trong `.env`.

---

## 7. Tài liệu tham chiếu

Toàn bộ đặc tả nghiệp vụ và kiến trúc nằm trong [docs/](docs/):

- [Thiet_lap_Chung_tu_OCR.md](docs/Thiet_lap_Chung_tu_OCR.md) – BA spec Module 1
- [Nhan_dang_Chung_tu_OCR.md](docs/Nhan_dang_Chung_tu_OCR.md) – BA spec Module 2
- [Quan_ly_Chung_tu_OCR.md](docs/Quan_ly_Chung_tu_OCR.md) – BA spec Module 3
- [Database_Design_OCR_System.md](docs/Database_Design_OCR_System.md) – DB design (PostgreSQL + Prisma)
- [Tech_Stack_Architecture.md](docs/Tech_Stack_Architecture.md) – Tech Stack Specification

---

## 8. Trạng thái dự án

| Hạng mục | Trạng thái |
|---|---|
| Monorepo skeleton | ✅ Đã có |
| Prisma schema (8 bảng + pgvector) | ✅ Đã có |
| Seed dữ liệu mẫu (7 trường + 6 cột) | ✅ Đã có |
| Backend modules (Health/Schema/Document/OCR Producer) | ✅ Đã có |
| Worker (Mock OCR + Embedding processors) | ✅ Đã có |
| Next.js 3 màn hình cơ bản | ✅ Đã có |
| MinIO upload integration | ⏳ Placeholder URL (cần wire vào S3 SDK) |
| Auth JWT | ⏳ Chưa wire (controller hiện public) |
| Excel export | ⏳ Chưa implement |
| Knowledge Base push | ⏳ Cấu trúc sẵn, chưa wire |
