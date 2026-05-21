# FOXAI – NATIVE

Nền tảng AI xử lý chứng từ & chatbot doanh nghiệp – kiến trúc Microservices Monorepo.

> **Tech stack:** pnpm Workspaces · TypeScript · NestJS · Next.js 14 · PostgreSQL × 3 + pgvector · Prisma · BullMQ · Redis · gRPC

---

## Kiến trúc tổng quan

```
Client (Next.js 14)
        │
        ▼
API Gateway  (:3001)  ← JWT Auth · Rate Limit · gRPC Proxy
  ├── System Service  (:3002)  → System DB  (:5432)
  ├── OCR Service     (:3003)  → OCR DB     (:5433)  ← BullMQ Workers
  └── Chatbot Service (:3004)  → Chatbot DB (:5434)  ← BullMQ Workers
                                                  ↑
                                           Redis  (:6379)
```

---

## Cấu trúc Monorepo

```
foxainative/
├── apps/
│   ├── api-gateway/          # NestJS – JWT Auth, gRPC proxy tới các service
│   ├── system-service/       # NestJS – Người dùng, Vai trò, Cơ cấu tổ chức
│   ├── ocr-service/          # NestJS – OCR, Schema, Document + BullMQ worker
│   ├── chatbot-service/      # NestJS – Knowledge Base, Chat AI + BullMQ worker
│   └── web-portal/           # Next.js 14 (App Router) – Giao diện quản trị
│
├── packages/
│   ├── shared-types/         # @foxai/shared-types  – Types & DTOs dùng chung
│   ├── system-db/            # @foxai/system-db     – Prisma client System DB
│   ├── ocr-db/               # @foxai/ocr-db        – Prisma client OCR DB
│   └── chatbot-db/           # @foxai/chatbot-db    – Prisma client Chatbot DB
│
├── docs/                     # Đặc tả nghiệp vụ & kiến trúc
├── scripts/                  # SQL init scripts (pgvector, pg_trgm)
├── docker-compose.yml        # 3× PostgreSQL + Redis
├── .env.example
└── pnpm-workspace.yaml
```

---

## Ports & Services

| Service | Package | Port | DB |
|---|---|---|---|
| Web Portal | `@foxai/web-portal` | 3000 | – |
| API Gateway | `@foxai/api-gateway` | 3001 | – |
| System Service | `@foxai/system-service` | 3002 | system-db :5432 |
| OCR Service | `@foxai/ocr-service` | 3003 | ocr-db :5433 |
| Chatbot Service | `@foxai/chatbot-service` | 3004 | chatbot-db :5434 |
| Redis | – | 6379 | – |

---

## Web Portal – Cấu trúc điều hướng

| Section | Route |
|---|---|
| **Tổng quan** | |
| Dashboard | `/` |
| Báo cáo & Thống kê | `/bao-cao` |
| Thông báo | `/thong-bao` |
| **Cấu hình hệ thống** | |
| Cấu hình vai trò | `/he-thong/vai-tro` |
| Cấu hình người dùng | `/he-thong/nguoi-dung` |
| Cơ cấu tổ chức | `/he-thong/to-chuc` |
| Thiết lập Chứng từ OCR | `/he-thong/ocr` |
| Thiết lập bot hội thoại | `/he-thong/chatbot` |
| **Tri thức AI** | |
| Quản lý tri thức | `/tri-thuc` |
| Kiểm duyệt & Phê duyệt | `/tri-thuc/kiem-duyet` |
| Upload tài liệu | `/tri-thuc/upload` |
| Kết nối dữ liệu tự động | `/tri-thuc/ket-noi` |
| OCR & Chuẩn hóa nội dung | `/tri-thuc/ocr-chuan-hoa` |
| **Xử lý tài liệu** | |
| Hóa đơn VAT đầu vào | `/xu-ly/hoa-don-vat` |
| Hợp đồng mua bán | `/xu-ly/hop-dong` |
| Phiếu nhập kho | `/xu-ly/phieu-nhap-kho` |
| Quản lý Chứng từ | `/xu-ly/chung-tu` |
| **Chatbot AI** | |
| Bot Kế toán Nội bộ | `/chatbot/ke-toan` |
| Bot CSKH – Kinh doanh | `/chatbot/cskh` |

---

## Yêu cầu cài đặt

| Thành phần | Phiên bản |
|---|---|
| Node.js | ≥ 20 LTS |
| pnpm | ≥ 8.0 |
| Docker Desktop | mới nhất |

---

## Khởi động (Bootstrap)

### 1. Cài dependencies

```bash
pnpm install
```

### 2. Tạo file `.env`

```bash
cp .env.example .env
```

### 3. Bật hạ tầng (3× PostgreSQL + Redis)

```bash
pnpm docker:up
```

### 4. Generate Prisma clients

```bash
pnpm db:generate:all
```

Hoặc từng DB riêng:

```bash
pnpm db:system:generate
pnpm db:ocr:generate
pnpm db:chatbot:generate
```

### 5. Chạy migrations + seed

```bash
pnpm db:migrate:all

# Seed dữ liệu mẫu OCR (schema INVOICE-VAT-IN)
pnpm db:ocr:seed
```

### 6. Chạy toàn bộ ứng dụng

```bash
pnpm dev
```

---

## Lệnh thường dùng

```bash
# ── Dev ──────────────────────────────────────────────────────
pnpm dev                                    # Chạy tất cả song song
pnpm --filter @foxai/web-portal dev         # Chỉ chạy frontend
pnpm --filter @foxai/ocr-service dev        # Chỉ chạy OCR service
pnpm --filter @foxai/api-gateway dev        # Chỉ chạy API Gateway

# ── Database ─────────────────────────────────────────────────
pnpm db:generate:all                        # Generate tất cả Prisma clients
pnpm db:migrate:all                         # Migrate tất cả DB

pnpm db:system:generate / migrate / seed / studio
pnpm db:ocr:generate    / migrate / seed / studio
pnpm db:chatbot:generate / migrate / seed / studio

# ── Docker ───────────────────────────────────────────────────
pnpm docker:up                              # Bật 3× Postgres + Redis
pnpm docker:down                            # Tắt
pnpm docker:logs                            # Theo dõi logs

# ── Build & Typecheck ────────────────────────────────────────
pnpm build
pnpm typecheck
pnpm lint
```

---

## OCR Provider

OCR Service hỗ trợ nhiều provider, cấu hình qua biến `OCR_PROVIDER` trong `.env`:

| Giá trị | Mô tả |
|---|---|
| `mock` | Dữ liệu giả – dùng để dev/test (mặc định) |
| `local-pdf` | Trích xuất text từ PDF local bằng pdfjs |
| `google-document-ai` | Google Document AI API |
| `aws-textract` | AWS Textract API |
| `fpt-ai` | FPT.AI OCR API |

Để thêm provider mới: tạo file trong `apps/ocr-service/src/modules/ocr/providers/` implement interface `IOcrProvider`, rồi đăng ký trong `ocr.module.ts`.

---

## Tài liệu tham chiếu

| File | Nội dung |
|---|---|
| [docs/Tech_Stack_Architecture.md](docs/Tech_Stack_Architecture.md) | Kiến trúc kỹ thuật tổng thể |
| [docs/Thiet_lap_Chung_tu_OCR.md](docs/Thiet_lap_Chung_tu_OCR.md) | BA spec – Module Thiết lập Schema |
| [docs/Nhan_dang_Chung_tu_OCR.md](docs/Nhan_dang_Chung_tu_OCR.md) | BA spec – Module Nhận dạng OCR |
| [docs/Quan_ly_Chung_tu_OCR.md](docs/Quan_ly_Chung_tu_OCR.md) | BA spec – Module Quản lý Chứng từ |
| [docs/Database_Design_OCR_System.md](docs/Database_Design_OCR_System.md) | Thiết kế Database (PostgreSQL + Prisma) |

---

## Trạng thái dự án

| Hạng mục | Trạng thái |
|---|---|
| Monorepo skeleton (5 apps · 4 packages) | ✅ Hoàn thành |
| Docker Compose (3× Postgres + Redis) | ✅ Hoàn thành |
| Prisma schemas (system · ocr · chatbot) | ✅ Hoàn thành |
| Seed dữ liệu mẫu OCR | ✅ Hoàn thành |
| OCR Service (Schema · Document · Queue · Providers) | ✅ Hoàn thành |
| Web Portal – Sidebar + 19 routes | ✅ Hoàn thành |
| API Gateway (JWT · gRPC proxy) | ⏳ Scaffold – chưa implement |
| System Service (User · Role · Org) | ⏳ Scaffold – chưa implement |
| Chatbot Service (Knowledge · Chat · Embedding) | ⏳ Scaffold – chưa implement |
| Web Portal – UI các màn hình | ⏳ Màn trắng – chờ implement |
| Auth JWT end-to-end | ⏳ Chưa wire |
