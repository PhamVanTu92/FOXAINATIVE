# FOXAI – NATIVE

Nền tảng AI xử lý chứng từ & chatbot doanh nghiệp – kiến trúc Microservices Monorepo.

> **Tech stack:** pnpm Workspaces · TypeScript · NestJS · .NET 9 · Next.js 14 · PostgreSQL × 3 + pgvector · Prisma + EF Core · BullMQ · Redis · gRPC

---

## Kiến trúc tổng quan

```
Client (Next.js 14)
        │
        ▼
API Gateway  (:3001)  ← JWT Auth · Rate Limit · gRPC Proxy
  ├── System Service  gRPC :50051  health :3002  → System DB  (:5432)   [.NET 9 + EF Core]
  ├── OCR Service     (:3003)                    → OCR DB     (:5433)   ← BullMQ Workers
  └── Chatbot Service (:3004)                    → Chatbot DB (:5434)   ← BullMQ Workers
                                                  ↑
                                           Redis  (:6379)
```

---

## Cấu trúc Monorepo

```
foxainative/
├── apps/
│   ├── api-gateway/          # NestJS – JWT Auth, gRPC proxy tới các service
│   ├── system-service/       # .NET 9 + gRPC – User, Role, Permission, Org Tree, JWT
│   ├── ocr-service/          # NestJS – OCR, Schema, Document + BullMQ worker
│   ├── chatbot-service/      # NestJS – Knowledge Base, Chat AI + BullMQ worker
│   └── web-portal/           # Next.js 14 (App Router) – Giao diện quản trị
│
├── packages/
│   ├── shared-types/         # @foxai/shared-types  – Types & DTOs dùng chung
│   ├── shared-proto/         # @foxai/shared-proto  – gRPC proto contracts (System + chung)
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
| System Service | `@foxai/system-service` | gRPC **51051** (native + Docker host) · health 3002 · container internal 50051 | system-db :5432 |
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
| .NET SDK | ≥ 9.0.100 (cho `system-service`) |
| `dotnet-ef` global tool | `dotnet tool install -g dotnet-ef` |
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

### 4. Generate Prisma clients (OCR + Chatbot)

```bash
pnpm db:generate:all
```

Hoặc từng DB riêng:

```bash
pnpm db:ocr:generate
pnpm db:chatbot:generate
```

> **System DB** dùng EF Core Code-First (.NET 9) — không cần generate, schema sinh từ entities C#.

### 5. Chạy migrations + seed

```bash
pnpm db:migrate:all                 # bao gồm: db:system:migrate (EF) + db:ocr:migrate + db:chatbot:migrate

# Seed dữ liệu mẫu OCR (schema INVOICE-VAT-IN)
pnpm db:ocr:seed
```

> System Service tự seed admin (`admin@foxai.local` / `Admin@12345`) + 3 roles + 25 permissions lúc khởi động Development/Test.

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
pnpm db:generate:all                        # Generate Prisma clients (OCR + Chatbot)
pnpm db:migrate:all                         # Migrate tất cả DB

# System (EF Core)
pnpm db:system:migrate                      # dotnet ef database update
pnpm db:system:migration:add Name           # dotnet ef migrations add
pnpm db:system:migration:remove
pnpm db:system:reset                        # DROP + apply lại

# OCR / Chatbot (Prisma)
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
| System Service (.NET 9 + gRPC · User · Role · Permission · Org · JWT) | ✅ Hoàn thành (5 service / 29 RPC · 35 integration tests pass · Dockerized) |
| Chatbot Service (Knowledge · Chat · Embedding) | ⏳ Scaffold – chưa implement |
| Web Portal – UI các màn hình | ⏳ Màn trắng – chờ implement |
| Auth JWT end-to-end | ⏳ Chưa wire |
