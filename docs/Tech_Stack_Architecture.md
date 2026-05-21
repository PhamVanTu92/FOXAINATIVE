# ĐẶC TẢ KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE SPECIFICATION)

> **Mã tài liệu:** ARCH-01
> **Phiên bản:** 2.0
> **Trạng thái:** ✅ Đã phê duyệt (Approved)
> **Phạm vi ứng dụng:** Toàn bộ hệ thống Monorepo FOXAINATIVE
> **Tham chiếu nghiệp vụ:** [[Thiet_lap_Chung_tu_OCR]], [[Nhan_dang_Chung_tu_OCR]], [[Quan_ly_Chung_tu_OCR]], [[Database_Design_OCR_System]]

---

## 1. Tổng quan Kiến trúc Hệ thống

### 1.1. Mô hình kiến trúc

Hệ thống áp dụng mô hình **Microservices kết hợp Event-Driven Asynchronous Processing**, giao tiếp nội bộ qua **gRPC**, phân tách rõ ràng thành 5 tầng:

| Tầng | Thành phần | Vai trò |
|---|---|---|
| **Client Layer** | Web Portal (SPA), Mobile App | Giao diện người dùng cuối |
| **Edge Layer** | API Gateway | Định tuyến, xác thực JWT, chuyển đổi giao thức |
| **Services Layer** | System Service, OCR Service, Chatbot Service | Logic nghiệp vụ độc lập theo miền |
| **Data Layer** | System_DB, OCR_DB, Chatbot_DB | Lưu trữ dữ liệu riêng biệt theo service |
| **Async Layer** | Redis + BullMQ | Xử lý tác vụ ngầm nặng bất đồng bộ |

### 1.2. Sơ đồ kiến trúc tổng thể

```
┌─────────────────────────────────────────┐
│                 CLIENTS                 │
│  • Web Portal (SPA)  • Mobile App       │
└────────────────────┬────────────────────┘
                     │
                     │ HTTPS / REST / gRPC-Web
                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     EDGE LAYER                                         │
│                                   [ API GATEWAY ]                                      │
│  • Định tuyến (Routing)                   • Xác thực tập trung (JWT Verification)     │
│  • Giới hạn tải (Rate Limiting)            • Chuyển đổi giao thức (REST ⇄ gRPC)       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            │ gRPC (Internal Communication)
                     ┌──────────────────────┼──────────────────────┐
                     │                      │                      │
                     ▼                      ▼                      ▼
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
│      SERVICES LAYER      │  │      SERVICES LAYER      │  │      SERVICES LAYER      │
│     [ System Service ]   │  │      [ OCR Service ]     │  │    [ Chatbot Service ]   │
│  • Quản lý Người dùng    │  │  • Thiết lập OCR Schema  │  │  • Quản lý Tri thức      │
│  • Phân quyền (RBAC)     │  │  • Thực thi nhận dạng    │  │  • Xử lý Vector Embedding│
│  • Cơ cấu tổ chức (Cây)  │  │  • Quản lý chứng từ      │  │  • Bot hội thoại AI      │
└────────────┬─────────────┘  └────────────┬─────────────┘  └────────────┬─────────────┘
             │                             │                             │
             │ Prisma ORM                  │ Prisma ORM                  │ Prisma ORM
             ▼                             ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
│        DATA LAYER        │  │        DATA LAYER        │  │        DATA LAYER        │
│      [ System_DB ]       │  │        [ OCR_DB ]        │  │      [ Chatbot_DB ]      │
│  • Lưu: Users, Roles,    │  │  • Lưu: Schemas, Values, │  │  • Lưu: Knowledge Base,  │
│    Permissions, Tree     │  │    Line-items, Audit     │  │    Chat Logs, Vectors    │
└──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘
                     │                      │                      │
                     └──────────────────────┼──────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ASYNC LAYER                                          │
│                    [ Message Broker & Task Queue: Redis / BullMQ ]                     │
│  • Xử lý tác vụ ngầm nặng (Bulk OCR, Phân tích File lớn, Đồng bộ dữ liệu bất đồng bộ) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cấu trúc Monorepo

```
foxai-native-monorepo/
├── apps/
│   ├── web-portal/             # CHUNG: 1 Frontend duy nhất chứa toàn bộ Menu hệ thống
│   │   ├── src/
│   │   │   └── modules/
│   │   │       ├── system/     # Màn hình: Vai trò, Người dùng, Cơ cấu tổ chức
│   │   │       ├── ocr/        # Màn hình: Thiết lập OCR, Nhận dạng, Quản lý chứng từ
│   │   │       └── chatbot/    # Màn hình: Quản lý tri thức, Khung chat Bot AI
│   │   └── package.json
│   │
│   ├── api-gateway/            # CHUNG: Tầng Edge xử lý Routing và Auth Token
│   │
│   ├── system-service/         # RIÊNG (Dev C): Backend quản lý phân quyền & tổ chức (.NET Core)
│   ├── ocr-service/            # RIÊNG (Dev A): Backend xử lý đường ống OCR (NestJS)
│   └── chatbot-service/        # RIÊNG (Dev B): Backend xử lý Chatbot & Vector AI (NestJS)
│
├── packages/
│   ├── system-db/              # RIÊNG: schema.prisma & migrations riêng của System DB
│   ├── ocr-db/                 # RIÊNG: schema.prisma & migrations riêng của OCR DB
│   ├── chatbot-db/             # RIÊNG: schema.prisma & migrations riêng của Chatbot DB
│   └── shared-types/           # CHUNG: Chứa các DTO, Interface, Event Types dùng chung toàn team
│
├── docker-compose.yaml         # Khởi tạo nhanh PostgreSQL (3 DB) + Redis (Hàng đợi)
├── pnpm-workspace.yaml         # Khai báo không gian làm việc Monorepo
├── package.json                # Scripts tổng khởi chạy dự án (Turbo/Concurrently)
└── tsconfig.json               # Cấu hình TypeScript cơ sở cho toàn bộ dự án
```

---

## 3. Chi tiết các Tầng

### 3.1. Edge Layer – API Gateway

API Gateway là điểm vào duy nhất (*single entry point*) của toàn bộ hệ thống – mọi request từ Client đều đi qua đây.

| Trách nhiệm | Chi tiết |
|---|---|
| **Định tuyến (Routing)** | Phân tích path/header, chuyển tiếp request đến đúng service backend tương ứng. |
| **Xác thực tập trung (JWT Verification)** | Kiểm tra và giải mã JWT Token trước khi forward xuống service – các service backend không cần tự xác thực lại. |
| **Giới hạn tải (Rate Limiting)** | Hạn chế số request/giây per IP hoặc per user để bảo vệ hệ thống khỏi flood. |
| **Chuyển đổi giao thức (REST ⇄ gRPC)** | Client dùng REST/HTTP; API Gateway dịch sang gRPC để gọi vào các service nội bộ. |

**Giao thức giao tiếp:**
- **Client → API Gateway:** HTTPS / REST / gRPC-Web
- **API Gateway → Services:** gRPC (nội bộ, hiệu năng cao, type-safe qua Protobuf)

---

### 3.2. Services Layer

Ba service được phát triển **độc lập theo miền nghiệp vụ**, mỗi service do một dev riêng phụ trách, không chia sẻ database với nhau.

#### System Service (Dev C)

| Trách nhiệm | Chi tiết |
|---|---|
| **Quản lý Người dùng** | CRUD Users, trạng thái tài khoản (active/inactive), hồ sơ cá nhân. |
| **Phân quyền (RBAC)** | Quản lý Roles, Permissions, gán quyền cho người dùng theo cơ chế Role-Based Access Control. |
| **Cơ cấu tổ chức (Cây)** | Xây dựng và quản lý cây tổ chức (phòng ban, đơn vị) dạng cấu trúc cây (Tree/Hierarchical). |

**Database:** `OCR_SystemDB` – lưu trữ: Users, Roles, Permissions, Organizational Tree.

#### OCR Service (Dev A)

| Trách nhiệm | Chi tiết |
|---|---|
| **Thiết lập OCR Schema** | Định nghĩa cấu trúc chứng từ: các trường đơn (header/footer), bảng lặp (line-items). |
| **Thực thi nhận dạng** | Nhận file ảnh/PDF, chạy pipeline OCR (tiền xử lý → nhận diện → mapping → validation). |
| **Quản lý chứng từ** | Lưu trữ, tra cứu, phê duyệt, và quản lý vòng đời chứng từ đã được OCR. |

**Database:** `OCR_DB` – lưu trữ: Schemas, Field Values, Line-items, Audit Logs.

#### Chatbot Service (Dev B)

| Trách nhiệm | Chi tiết |
|---|---|
| **Quản lý Tri thức** | Nhập, phân loại, và quản lý tài liệu trong Knowledge Base. |
| **Xử lý Vector Embedding** | Sinh vector embedding từ nội dung tài liệu, lưu vào DB để phục vụ semantic search. |
| **Bot hội thoại AI** | Xử lý câu hỏi người dùng, tìm kiếm ngữ nghĩa trong Knowledge Base, trả lời dựa trên LLM. |

**Database:** `Chatbot_DB` – lưu trữ: Knowledge Base, Chat Logs, Vector Embeddings.

---

### 3.3. Data Layer – 3 Database độc lập

Mỗi service sở hữu database riêng, không truy cập chéo qua SQL. Giao tiếp dữ liệu giữa các service (nếu cần) phải thông qua gRPC hoặc Message Queue.

| Database | PostgreSQL |Instance | Nội dung lưu trữ | Package Prisma |
|---|---|---|---|
| **OCR_SystemDB** | `OCR_SystemDB` | Users, Roles, Permissions, Org Tree | `packages/ocr_systemdb` |
| **OCR_DB** | `ocr_db` | Schemas, Field Values, Line-items, Audit | `packages/ocr-db` |
| **Chatbot_DB** | `chatbot_db` | Knowledge Base, Chat Logs, Vectors | `packages/chatbot-db` |

**Quy tắc cách ly dữ liệu:**
- Service A **không được** gọi `prisma` của service B.
- Mọi nhu cầu dữ liệu cross-service phải đi qua gRPC call hoặc Event trên Message Queue.
- Migration của mỗi DB được quản lý độc lập trong package tương ứng.

---

### 3.4. Async Layer – Redis / BullMQ

Tầng xử lý bất đồng bộ dùng cho các tác vụ ngầm nặng, không thể xử lý trong scope của một HTTP request thông thường.

| Tác vụ | Queue | Service sản xuất | Service tiêu thụ |
|---|---|---|---|
| **Bulk OCR** | `ocr-queue` | OCR Service | OCR Service Worker |
| **Phân tích File lớn** | `file-analysis-queue` | OCR Service | OCR Service Worker |
| **Sinh Vector Embedding** | `embedding-queue` | Chatbot Service | Chatbot Service Worker |
| **Đồng bộ Knowledge Base** | `kb-sync-queue` | Chatbot Service | Chatbot Service Worker |

**Nguyên tắc:**
- Job payload chỉ chứa ID tham chiếu (không chứa file binary).
- Retry policy mặc định: 3 lần, exponential backoff.
- Mỗi job có timeout tối đa phù hợp với loại tác vụ.

---

## 4. Phân công phát triển

| App / Package | Loại | Phụ trách | Ghi chú |
|---|---|---|---|
| `apps/web-portal` | Frontend (Next.js) | **Chung** | Tất cả dev cùng đóng góp theo module |
| `apps/api-gateway` | Edge (NestJS / Fastify) | **Chung** | Setup routing + auth tập trung |
| `apps/system-service` | Backend (NestJS + gRPC) | **Dev C** | RBAC, Users, Org Tree |
| `apps/ocr-service` | Backend (NestJS + gRPC) | **Dev A** | OCR pipeline, Schema, Documents |
| `apps/chatbot-service` | Backend (NestJS + gRPC) | **Dev B** | Chatbot AI, Vector Search |
| `packages/system-db` | Prisma Schema | **Dev C** | Schema + migrations của System_DB |
| `packages/ocr-db` | Prisma Schema | **Dev A** | Schema + migrations của OCR_DB |
| `packages/chatbot-db` | Prisma Schema | **Dev B** | Schema + migrations của Chatbot_DB |
| `packages/shared-types` | TypeScript Types | **Chung** | DTOs, Interfaces, Event Types |

---

## 5. Khởi động môi trường phát triển (Local Dev)

### 5.1. Cấu hình `docker-compose.yaml`

Khởi tạo **3 PostgreSQL database** + **1 Redis** bằng Docker Compose:

```yaml
services:
  system-db:
    image: postgres:16-alpine
    container_name: foxai-system-db
    environment:
      POSTGRES_USER: system_user
      POSTGRES_PASSWORD: system_pass
      POSTGRES_DB: system_db
    ports:
      - "5432:5432"

  ocr-db:
    image: pgvector/pgvector:pg16
    container_name: foxai-ocr-db
    environment:
      POSTGRES_USER: ocr_user
      POSTGRES_PASSWORD: ocr_pass
      POSTGRES_DB: ocr_db
    ports:
      - "5433:5432"

  chatbot-db:
    image: pgvector/pgvector:pg16
    container_name: foxai-chatbot-db
    environment:
      POSTGRES_USER: chatbot_user
      POSTGRES_PASSWORD: chatbot_pass
      POSTGRES_DB: chatbot_db
    ports:
      - "5434:5432"

  redis:
    image: redis:7-alpine
    container_name: foxai-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
```

### 5.2. Quy trình khởi động

```bash
# 1. Bật hạ tầng (3 DB + Redis)
docker compose up -d

# 2. Cài dependencies
pnpm install

# 3. Generate Prisma Client cho từng DB
pnpm --filter @foxai/system-db prisma:generate
pnpm --filter @foxai/ocr-db prisma:generate
pnpm --filter @foxai/chatbot-db prisma:generate

# 4. Chạy migrations cho từng DB
pnpm --filter @foxai/system-db prisma:migrate:dev
pnpm --filter @foxai/ocr-db prisma:migrate:dev
pnpm --filter @foxai/chatbot-db prisma:migrate:dev

# 5. Khởi chạy toàn bộ hệ thống song song
pnpm dev
```

### 5.3. Biến môi trường mẫu (`.env.example`)

```bash
# ============================================
# SYSTEM DB
# ============================================
SYSTEM_DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/system_db"

# ============================================
# OCR DB
# ============================================
OCR_DATABASE_URL="postgresql://ocr_user:ocr_pass@localhost:5433/ocr_db"

# ============================================
# CHATBOT DB
# ============================================
CHATBOT_DATABASE_URL="postgresql://chatbot_user:chatbot_pass@localhost:5434/chatbot_db"

# ============================================
# REDIS / BULLMQ
# ============================================
REDIS_URL="redis://localhost:6379"

# ============================================
# AUTH (JWT) - dùng tại API Gateway
# ============================================
JWT_SECRET="change-me-in-production"
JWT_EXPIRES_IN="7d"

# ============================================
# gRPC ENDPOINTS (nội bộ)
# ============================================
SYSTEM_SERVICE_GRPC_URL="localhost:50051"
OCR_SERVICE_GRPC_URL="localhost:50052"
CHATBOT_SERVICE_GRPC_URL="localhost:50053"

# ============================================
# OCR PROVIDER
# ============================================
OCR_PROVIDER="google-document-ai"
OCR_API_KEY="xxxxxxxxxxxxxxxx"

# ============================================
# EMBEDDING
# ============================================
OPENAI_API_KEY="sk-xxxxxxxxxxxx"
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_DIMENSIONS=1536

# ============================================
# APP
# ============================================
NODE_ENV="development"
WEB_PORT=3000
API_GATEWAY_PORT=3001
SYSTEM_SERVICE_PORT=3002
OCR_SERVICE_PORT=3003
CHATBOT_SERVICE_PORT=3004
```

---

## 6. Bảng tổng hợp Tech Stack

| Tầng | Công nghệ | Phiên bản |
|---|---|---|
| **Package Manager** | pnpm + Workspaces | 8.x |
| **Ngôn ngữ** | TypeScript (strict mode) | 5.x |
| **Frontend** | Next.js + React + Tailwind CSS | 14 / 18 / 3 |
| **API Gateway** | NestJS + Node.js| 10 / 20 LTS |
| **Backend Services** | NestJS/.NET Core + gRPC (Protobuf) | 10 / 20 LTS |
| **ORM** | Prisma (3 schema riêng biệt) | 5.x |
| **Database** | PostgreSQL + pgvector | 16 / 0.7+ |
| **Cache / Queue** | Redis + BullMQ | 7.x / 5.x |
| **OCR Provider** | Google Document AI / AWS Textract / FPT.AI | – |
| **Embedding Provider** | OpenAI `text-embedding-3-small` / Voyage AI | – |
| **Build System** | Turborepo hoặc Concurrently | – |

---

> 📌 **Tài liệu liên quan:**
> - [[Thiet_lap_Chung_tu_OCR]] – Đặc tả nghiệp vụ Schema Configuration (OCR Service).
> - [[Nhan_dang_Chung_tu_OCR]] – Đặc tả nghiệp vụ OCR Execution (OCR Service).
> - [[Quan_ly_Chung_tu_OCR]] – Đặc tả nghiệp vụ Document Management (OCR Service).
> - [[Database_Design_OCR_System]] – Thiết kế Cơ sở Dữ liệu cho OCR_DB.
