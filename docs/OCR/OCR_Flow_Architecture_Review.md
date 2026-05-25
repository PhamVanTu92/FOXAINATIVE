# ĐÁNH GIÁ LUỒNG HOẠT ĐỘNG & CẤU TRÚC FILE – OCR MODULE

> **Mã tài liệu:** OCR-REVIEW-01
> **Phiên bản:** 1.0
> **Ngày:** 2026-05-22
> **Tham chiếu kiến trúc:** [[Tech_Stack_Architecture]] (ARCH-01 v2.0)

---

## 1. Luồng Hoạt Động Hiện Tại

### 1.1. Sơ đồ tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WEB PORTAL (Next.js :3000)                  │
│                                                                     │
│  /he-thong/ocr          /xu-ly/nhan-dang/[schemaCode]               │
│  /he-thong/ocr/tao-moi  /xu-ly/chung-tu                            │
│  /he-thong/ocr/[id]                                                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST/HTTP  (direct, no gateway)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       OCR SERVICE (NestJS :3003)                    │
│                                                                     │
│  SchemaController  ──►  SchemaService  ──►  PrismaService          │
│  DocumentController ──► DocumentService ──► PrismaService          │
│                             │                                       │
│                             │ enqueue()                             │
│                             ▼                                       │
│                    OcrProducerService                               │
│                             │                                       │
│                             │ BullMQ add('scan', payload)          │
│                             ▼                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ Redis Queue: "foxai:ocr-queue"
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     OCR WORKER (cùng process)                       │
│                                                                     │
│  OcrProcessor.process(job)                                          │
│       │                                                             │
│       ├─► Đọc schema từ OCR_DB                                      │
│       ├─► Gọi IOcrProvider.scan()  ◄── env: OCR_PROVIDER            │
│       │       ├─ mock (default)                                     │
│       │       ├─ claude  (ANTHROPIC_API_KEY)                        │
│       │       ├─ gemini  (GEMINI_API_KEY)                           │
│       │       └─ local-pdf                                          │
│       └─► Transaction: upsert values + lineItems + update status   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │ Prisma ORM
                              ▼
                    ┌─────────────────────┐
                    │      OCR_DB         │
                    │  PostgreSQL :5433   │
                    │                    │
                    │  document_schemas  │
                    │  document_fields   │
                    │  document_tables   │
                    │  document_table_   │
                    │    columns         │
                    │  documents         │
                    │  document_values   │
                    │  document_line_    │
                    │    items           │
                    │  document_audit_   │
                    │    logs            │
                    └─────────────────────┘
```

---

### 1.2. Luồng 1 – Thiết lập Schema (Cấu hình chứng từ)

```
[Admin] /he-thong/ocr
   │
   ├─► GET /schemas              → danh sách + thống kê
   ├─► GET /schemas/:id          → chi tiết schema, fields, tables, columns
   │
   ├─► [Tạo mới] /he-thong/ocr/tao-moi
   │       └─► POST /schemas     → tạo schema + fields + tables trong 1 lần
   │
   └─► [Sửa] /he-thong/ocr/[id]
           ├─► PATCH /schemas/:id             → sửa tên/mô tả/active
           ├─► POST  /schemas/:id/fields      → thêm field
           ├─► PATCH /schemas/:id/fields/:fid → sửa field
           ├─► DELETE /schemas/:id/fields/:fid→ xóa field
           ├─► POST  /schemas/:id/tables      → thêm bảng
           ├─► PATCH /schemas/:id/tables/:tid → sửa bảng
           └─► DELETE /schemas/:id/tables/:tid→ xóa bảng
```

**Ràng buộc quan trọng:**
- `code` schema là unique, dùng làm slug URL cho màn hình nhận dạng
- Schema bị vô hiệu hóa (`isActive=false`) không nhận upload tài liệu mới
- Xóa schema cascade xóa toàn bộ fields, tables, columns

---

### 1.3. Luồng 2 – Nhận dạng chứng từ (OCR Pipeline)

```
[User] /xu-ly/nhan-dang/[schemaCode]
   │
   ├─ Bước 1: UPLOAD
   │   POST /documents/upload  { file, schemaId, language }
   │       │
   │       ├─► Validate: MIME type (pdf/png/jpg/tiff/docx), max 25MB
   │       ├─► Lưu file disk → UPLOAD_DIR (file:///path/to/upload)
   │       ├─► Tạo Document { status: DRAFT } trong OCR_DB
   │       ├─► Ghi AuditLog { action: 'CREATE' }
   │       └─► OcrProducerService.enqueue({ documentId, schemaId, fileUrl, ... })
   │               └─► BullMQ job: id = "ocr-{documentId}"
   │
   │   Response: { documentId, jobId, status: 'QUEUED' }
   │
   ├─ Bước 2: POLLING (Frontend tự polling mỗi 3s)
   │   GET /documents/:id
   │       └─► Trả về document với status hiện tại
   │           ├─ DRAFT       → đang chờ trong queue
   │           ├─ PROCESSED   → OCR xong, có kết quả
   │           └─ ERROR       → thất bại, có ocrError
   │
   ├─ Bước 3: REVIEW & EDIT (chỉ khi status = PROCESSED)
   │   PATCH /documents/:id  { values: [...], lineItems: [...] }
   │       ├─► Upsert DocumentValue với isManuallyEdited=true
   │       ├─► Xóa + tạo lại DocumentLineItem
   │       └─► Ghi AuditLog { action: 'EDIT_FIELD' }
   │
   └─ Bước 4: CONFIRM
       POST /documents/:id/confirm  { note? }
           └─► status: PROCESSED → CONFIRMED
               └─► Ghi AuditLog { action: 'STATUS_CHANGE' }
```

**OCR Worker (bất đồng bộ):**
```
OcrProcessor.process(job) – concurrency = WORKER_CONCURRENCY (default: 3)
   │
   ├─ 10%: nhận job
   ├─ 20%: tải schema + fields từ OCR_DB
   ├─ 70%: gọi IOcrProvider.scan(request)
   │           ├─ Claude: base64 → Messages API (claude-sonnet-4-5)
   │           └─ Gemini: base64 → GenerativeAI (gemini-2.5-flash)
   │
   └─ 100%: Transaction
           ├─ deleteMany cũ (không manual)
           ├─ upsert DocumentValue (field → stringValue + bbox + confidence)
           ├─ create DocumentLineItem (stt, name, unit, qty, price, amount)
           ├─ update Document { status=PROCESSED, denorm fields, ocrConfidence }
           └─ create AuditLog { action: 'OCR_COMPLETE' }

   Retry: 3 lần, exponential backoff 2s
   Error: status → ERROR, lưu ocrError message
   Dup (P2002): trả ok=true, không retry (hóa đơn trùng MST+số)
```

---

### 1.4. Luồng 3 – Quản lý chứng từ

```
[User] /xu-ly/chung-tu
   │
   ├─ Xem danh sách
   │   GET /documents?search=&status=&type=&schemaCode=&dateFrom=&dateTo=&page=&pageSize=
   │   GET /documents/stats
   │
   ├─ Xem chi tiết (split-view: viewer gốc + detail panel)
   │   GET /documents/:id                → full detail + values + lineItems + auditLogs
   │   GET /documents/:id/file           → stream file gốc (pdf/image)
   │
   ├─ Xác nhận
   │   POST /documents/:id/confirm                        → đơn lẻ
   │   POST /documents/bulk-confirm { documentIds }       → hàng loạt
   │       └─► DRAFT/PROCESSED → CONFIRMED
   │
   ├─ Chuyển kho tri thức
   │   POST /documents/:id/transfer                       → đơn lẻ
   │   POST /documents/bulk-transfer { documentIds }      → hàng loạt
   │       └─► CONFIRMED → TRANSFERRED
   │
   └─ Xóa
       DELETE /documents/:id                              → đơn lẻ
       POST /documents/bulk-delete { documentIds }        → hàng loạt
           └─► Chỉ xóa được DRAFT / ERROR
```

**Vòng đời trạng thái:**
```
DRAFT ──(OCR xong)──► PROCESSED ──(Confirm)──► CONFIRMED ──(Transfer)──► TRANSFERRED
  │                       │                        │
  │                       └──(Confirm)─────────────┘
  │
  └──(OCR fail)──► ERROR
  │
  ▼
(Xóa được: DRAFT / ERROR)
```

---

## 2. Đánh giá Luồng Hoạt Động

### 2.1. Điểm mạnh ✅

| Hạng mục | Nhận xét |
|---|---|
| **Async pipeline** | Đúng thiết kế: upload → queue → worker → kết quả. Không block HTTP request. |
| **Multi-provider OCR** | Pattern Provider Interface + DI tốt. Dễ thêm provider mới (Google Doc AI, AWS Textract) chỉ cần implement `IOcrProvider`. |
| **Retry & error handling** | 3 lần, exponential backoff. Trạng thái ERROR rõ ràng, lưu message lỗi. |
| **Audit trail** | Mọi thay đổi trạng thái + chỉnh sửa đều ghi `DocumentAuditLog`. |
| **Denormalization có kiểm soát** | Các trường hay filter (invoiceNumber, sellerTaxCode...) được lưu trực tiếp trên Document để query nhanh, không phải join DocumentValue. |
| **Duplicate guard** | Constraint unique `(sellerTaxCode, invoiceNumber)` chặn hóa đơn trùng ở tầng DB. |
| **Transaction** | Toàn bộ write trong OCR worker dùng `$transaction` – đảm bảo atomic. |
| **File streaming** | `StreamableFile` + `@Res({ passthrough: true })` chuẩn NestJS, stream file gốc trực tiếp từ disk. |

### 2.2. Điểm cần cải thiện ⚠️

| # | Vấn đề | Mức độ | Chi tiết |
|---|---|---|---|
| 1 | ~~**Frontend polling thủ công**~~ ✅ | ~~Trung bình~~ | Đã thay bằng SSE (`EventSource` → `GET /documents/:id/sse`). Server push event `progress / done / failed`, frontend không cần `setInterval`. |
| 2 | **File lưu local disk** | Cao | `fileUrl = file:///path/on/server`. Khi scale sang nhiều pod/node sẽ không chia sẻ được file. Cần chuyển sang object storage (MinIO, S3). |
| 3 | **Worker chạy chung process** | Trung bình | `OcrProcessor` chạy trong cùng NestJS app với HTTP server. Job OCR nặng có thể ảnh hưởng event loop. Nên tách ra worker process riêng. |
| 4 | **Không có auth/guard** | Cao | `main.ts` không có JWT guard, CORS `origin: true` mở hoàn toàn. Hiện đang dùng được vì dev môi trường, nhưng cần có guard trước khi production. |
| 5 | **`transfer` chưa tích hợp Chatbot Service** | Cao | `POST /documents/:id/transfer` chỉ đổi status → TRANSFERRED trong OCR_DB, chưa gọi sang Chatbot Service để thực sự đưa dữ liệu vào Knowledge Base. |
| 6 | ~~**Polling job progress không có endpoint riêng**~~ ✅ | ~~Nhỏ~~ | Đã thêm `GET /documents/:id/job-status` (expose trạng thái BullMQ) và SSE endpoint `GET /documents/:id/sse` phục vụ push real-time. |
| 7 | ~~**`lineItems` trong bảng nhưng lưu flat**~~ ✅ | ~~Nhỏ~~ | Đã thêm cột `tableKey` (nullable) vào `DocumentLineItem`. Migration `20260522120000`. Provider Claude/Gemini được hướng dẫn điền `tableKey` theo tên bảng trong schema. |

---

## 3. Đánh giá Cấu trúc File So với ARCH-01

### 3.1. Sơ đồ so sánh

| Thành phần | ARCH-01 quy định | Thực tế hiện tại | Trạng thái |
|---|---|---|---|
| `apps/web-portal` | Next.js SPA, toàn bộ menu hệ thống | ✅ Có, Next.js 14 App Router | **Khớp** |
| `apps/api-gateway` | Edge layer: routing, JWT, rate limit | ❌ Thư mục chưa tồn tại | **Thiếu** |
| `apps/ocr-service` | Backend NestJS + gRPC, Dev A | ✅ Có, NestJS – nhưng REST thay vì gRPC | **Một phần** |
| `apps/system-service` | Backend NestJS + gRPC, Dev C | ❓ Không thể kiểm tra trong scope | – |
| `apps/chatbot-service` | Backend NestJS + gRPC, Dev B | ❓ Không thể kiểm tra trong scope | – |
| `packages/ocr-db` | Prisma schema + migrations riêng | ✅ Có, schema.prisma đầy đủ | **Khớp** |
| `packages/shared-types` | DTOs, Interfaces, Event Types chung | ✅ Có (`ocr.ts`, `queue.ts`, `dto.ts`...) | **Khớp** |
| `packages/system-db` | Prisma schema riêng của System | ❓ Không kiểm tra | – |
| `packages/chatbot-db` | Prisma schema riêng của Chatbot | ❓ Không kiểm tra | – |
| Redis + BullMQ | Async layer, ocr-queue | ✅ Có, cấu hình đúng prefix `foxai:` | **Khớp** |
| 3 DB độc lập | system_db :5432, ocr_db :5433, chatbot_db :5434 | ✅ Docker Compose đúng cấu hình | **Khớp** |

---

### 3.2. Cấu trúc bên trong `ocr-service`

**ARCH-01** không quy định chi tiết cấu trúc nội bộ service, nhưng theo chuẩn NestJS domain-driven:

```
apps/ocr-service/src/
├── app.module.ts                          ✅ Root module
├── main.ts                                ✅ Bootstrap, Swagger, CORS
├── common/
│   ├── config/config.validation.ts        ✅ Joi validation cho env vars
│   ├── filters/http-exception.filter.ts   ✅ Global exception filter
│   └── prisma/
│       ├── prisma.module.ts               ✅ Global Prisma module
│       └── prisma.service.ts              ✅ Wrapper PrismaClient
└── modules/
    ├── health/                            ✅ Health check endpoint
    ├── schema/
    │   ├── schema.module.ts               ✅
    │   ├── schema.controller.ts           ✅ REST: /schemas
    │   ├── schema.service.ts              ✅ Business logic
    │   └── dto/schema.dto.ts              ✅ Validation DTOs
    ├── document/
    │   ├── document.module.ts             ✅
    │   ├── document.controller.ts         ✅ REST: /documents
    │   ├── document.service.ts            ✅ Business logic
    │   └── dto/document.dto.ts            ✅ Validation DTOs
    └── ocr/
        ├── ocr.module.ts                  ✅ BullMQ queue setup, provider DI
        ├── ocr-producer.service.ts        ✅ Enqueue jobs
        ├── processors/
        │   └── ocr.processor.ts           ✅ Worker: consume + process jobs
        └── providers/
            ├── ocr.provider.ts            ✅ Interface IOcrProvider
            ├── mock-ocr.provider.ts       ✅ Dev/test provider
            ├── local-pdf-ocr.provider.ts  ✅ Local extraction
            ├── claude-ocr.provider.ts     ✅ Anthropic Claude
            └── gemini-ocr.provider.ts     ✅ Google Gemini
```

**Nhận xét:** Cấu trúc nội bộ `ocr-service` rõ ràng, tách biệt tốt theo module và trách nhiệm.

---

### 3.3. Cấu trúc bên trong `web-portal`

**ARCH-01 quy định:**
```
src/
└── modules/
    ├── system/    # Vai trò, Người dùng, Cơ cấu tổ chức
    ├── ocr/       # Thiết lập OCR, Nhận dạng, Quản lý chứng từ
    └── chatbot/   # Quản lý tri thức, Khung chat Bot AI
```

**Thực tế (Next.js App Router convention):**
```
src/app/(main)/
├── he-thong/
│   ├── vai-tro/        → system (Vai trò)
│   ├── nguoi-dung/     → system (Người dùng)
│   ├── to-chuc/        → system (Cơ cấu tổ chức)
│   ├── chatbot/        → system (Cấu hình chatbot)
│   └── ocr/            → ocr (Thiết lập Schema)
│       ├── page.tsx
│       ├── tao-moi/
│       └── [id]/
├── xu-ly/
│   ├── nhan-dang/[schemaCode]/  → ocr (Nhận dạng)
│   ├── chung-tu/                → ocr (Quản lý chứng từ)
│   ├── hoa-don-vat/             → ocr (lọc theo loại)
│   ├── hop-dong/                → ocr (lọc theo loại)
│   └── phieu-nhap-kho/          → ocr (lọc theo loại)
├── tri-thuc/                    → chatbot (Knowledge Base)
└── chatbot/                     → chatbot (Chat UI)
```

**Nhận xét:** Tên thư mục dùng tiếng Việt (slug URL) thay vì domain-module names như ARCH-01 đề xuất. Đây là trade-off hợp lý cho Next.js App Router – URL thân thiện với người dùng Việt Nam. Tuy nhiên cần **thống nhất trong team** để tránh nhầm lẫn về mapping giữa route và domain.

---

### 3.4. Điểm lệch quan trọng nhất: Thiếu API Gateway

**ARCH-01 yêu cầu:**
```
Client ──HTTPS──► API Gateway ──gRPC──► OCR Service
                     │
                     ├─ JWT Verification
                     ├─ Rate Limiting
                     └─ REST ⇄ gRPC
```

**Thực tế:**
```
Web Portal ──REST/HTTP──► OCR Service (trực tiếp :3003)
                              └─ Không có auth guard
                              └─ CORS origin: true (mọi origin)
```

Hậu quả:
- Không có xác thực người dùng – bất kỳ ai biết port 3003 đều gọi được API
- Không có rate limiting – dễ bị lạm dụng upload
- OCR Service đang dùng REST (không phải gRPC) – không thể kết nối vào API Gateway gRPC như thiết kế
- Khi tích hợp liên service (OCR → Chatbot transfer) không có channel gRPC để giao tiếp

---

## 4. Tóm tắt & Ưu tiên xử lý

### Cấu trúc file: **Tốt (8/10)**
Monorepo tổ chức đúng per ARCH-01. Nội bộ `ocr-service` clean, module hóa tốt. Điểm trừ: `web-portal` dùng URL slug tiếng Việt thay vì module names, và `api-gateway` chưa có.

### Luồng nghiệp vụ: **Tốt (7.5/10)**
Async pipeline đúng thiết kế, retry/error handling đầy đủ, audit trail hoàn chỉnh, multi-provider linh hoạt. Ba điểm cần giải quyết trước production:

| Ưu tiên | Việc cần làm |
|---|---|
| 🔴 **P0** | Thêm API Gateway hoặc ít nhất JWT guard trực tiếp tại OCR Service |
| 🔴 **P0** | Chuyển file storage sang object storage (MinIO/S3) |
| 🟠 **P1** | Triển khai thực sự luồng `transfer → Chatbot Service` |
| 🟠 **P1** | Expose endpoint `GET /documents/:id/job-status` để frontend theo dõi tiến trình chính xác |
| 🟡 **P2** | Tách OCR worker ra process riêng |
| 🟡 **P2** | Thêm `tableId` vào `DocumentLineItem` nếu cần hỗ trợ multi-table schema |
