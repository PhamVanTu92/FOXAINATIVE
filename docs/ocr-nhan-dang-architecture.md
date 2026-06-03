# Kiến Trúc & Luồng Logic — Nhận Dạng OCR

## 1. Tổng Quan

Module **Nhận Dạng OCR** cho phép người dùng tải lên chứng từ (hóa đơn, hợp đồng, biên bản...), hệ thống sẽ dùng AI (Gemini hoặc Claude) để trích xuất dữ liệu tự động, sau đó người dùng có thể chỉnh sửa, xác nhận và đẩy vào bộ tri thức.

---

## 2. Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────┐
│                   WEB PORTAL (Next.js)                  │
│                                                         │
│  NhanDangView.tsx                                       │
│    ├── useOcrRecognition (hook chính)                   │
│    │     ├── Upload file → API                          │
│    │     ├── SSE listener (real-time progress)          │
│    │     ├── Queue state management                     │
│    │     └── Edit / Save / Confirm                      │
│    └── UI: split panel (preview ← | → dữ liệu)         │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────┐
│                  OCR SERVICE (NestJS)                   │
│                                                         │
│  DocumentController  →  DocumentService                 │
│       │                     │                           │
│       │              OcrProducerService                 │
│       │                     │                           │
│       │              BullMQ Queue (ocr)                 │
│       │                     │                           │
│       │              OcrProcessor                       │
│       │                ┌────┴────┐                      │
│       │            GeminiOcr  ClaudeOcr                 │
│       │            LocalPdf   MockOcr                   │
│       │                                                 │
│       └── SSE endpoint (poll job 600ms, timeout 10min)  │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              DATABASE (PostgreSQL / Prisma)             │
│  documents, document_values, line_items, audit_logs     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Luồng Xử Lý End-to-End

```
1. User kéo/thả hoặc chọn file
         │
2. acceptFiles() → file đưa vào queue UI (status: uploading)
         │
3. triggerOCR(provider) → POST /documents/upload
   • Multipart form: file + schemaCode + provider + language
   • Upload tối đa 20 file, 25MB/file
   • MIME hợp lệ: PDF, PNG, JPEG, GIF, WebP, TIFF, DOCX, XLSX, XLS, CSV
         │
4. Backend tạo Document record (status: DRAFT)
   → OcrProducerService.enqueue() → BullMQ job "ocr-{documentId}"
         │
5. Frontend nhận documentId → startSSE(documentId)
   • SSE poll GET /documents/{id}/sse (600ms interval)
   • Emit events: progress | done | failed
         │
6. OcrProcessor xử lý job (concurrency = env OCR_CONCURRENCY, default 3):
   • 10%  → Khởi tạo
   • 20%  → Load schema từ DB
   • 20–65% → Scan file (theo loại):
       - PDF  → tách từng trang → batch 5 trang song song
       - Excel → tách chunk → batch 5 chunk song song
       - Ảnh/Word → scan trực tiếp
       - Nhiều file → xử lý tuần tự
   • 70%  → Merge kết quả
   • 100% → Lưu DB (values, lineItems, confidence), status → PROCESSED
         │
7. SSE emit "done" → Frontend:
   • Queue item status: done
   • Tải chi tiết document (GET /documents/{id})
   • Render dữ liệu vào panel bên phải
         │
8. User chỉnh sửa fields + line items
   • Validate arithmetic (qty × unitPrice = amount, v.v.)
   • handleSave() → PATCH /documents/{id}
         │
9. Xác nhận:
   • handleConfirmWithKb() → POST /documents/{id}/confirm
   • Đẩy vào Knowledge Base (nếu chọn)
   • status → CONFIRMED
```

---

## 4. Frontend Layer

### 4.1 File Chính

| File | Vai trò |
|------|---------|
| `modules/xu-ly/views/NhanDangView.tsx` | View layer — toàn bộ JSX, split panel |
| `modules/xu-ly/hooks/useOcrRecognition.ts` | Hook chính — state, logic, API calls |
| `lib/ocr-api.ts` | Typed fetch wrappers — tất cả endpoint OCR |
| `modules/xu-ly/constants.ts` | Hằng số: STATUS_CONFIG, TYPE_CONFIG, formatters |

### 4.2 Hook `useOcrRecognition`

**State quản lý:**

```typescript
// Queue xử lý
queueItems: QueueItem[]          // Danh sách file đang/đã xử lý
// QueueItem.status: 'uploading' | 'queued' | 'processing' | 'done' | 'error'

// Dữ liệu OCR của item đang xem
currentDoc: DocDetail | null     // Chi tiết chứng từ từ backend
fieldValues: Record<string, string> // Giá trị các field (key = schemaField.key)
lineItems: LineItem[]            // Dòng hàng hóa/dịch vụ

// Cấu hình
ocrProvider: 'gemini' | 'claude' // Provider AI đang chọn
schema: SchemaDetail | null      // Schema áp dụng

// UI state
selectedQueueIdx: number         // Item đang được focus trong queue
anyProcessing: boolean           // Có file nào đang chạy không
```

**Vòng đời một file trong queue:**

```
acceptFiles(files)
  → forEach file: queueItems.push({ status: 'uploading', file })
  → uploadToBackend(file)
      → status: 'queued'
      → startSSE(documentId)

SSE events:
  'progress' → status: 'processing', progress: number
  'done'     → status: 'done', load doc detail
  'failed'   → status: 'error', errorMsg: string
```

**Các hàm chính:**

```typescript
acceptFiles(files: File[])           // Nhận file từ drop/input
triggerOCR(provider)                 // Upload + enqueue job
startSSE(documentId)                 // Kết nối SSE stream
setFieldValue(key, value)            // Cập nhật field
addLineItem() / removeLineItem(idx)  // Thêm/xóa dòng hàng
updateLi(idx, col, value)            // Sửa dòng hàng
handleSave()                         // PATCH document
handleSaveAndExit()                  // Save + redirect
handleExport()                       // Export JSON
```

**Arithmetic validation:**

```typescript
// Cảnh báo tự động khi giá trị không khớp:
qty × unitPrice ≠ amount    // → highlight dòng hàng
subtotal + VAT ≠ totalAmount // → highlight tổng
```

### 4.3 View `NhanDangView.tsx`

**Layout:** Split panel có thể resize kéo divider:

```
┌────────────────────┬──────────────────────────────────┐
│   PREVIEW PANEL    │        DATA PANEL                │
│                    │                                  │
│  [FilePreviewPane] │  [Queue sidebar]                 │
│  • Image viewer    │  [Field editor]                  │
│  • PDF embed       │  [LineItem table]                │
│  • Fallback icon   │  [Save / Confirm buttons]        │
│                    │                                  │
└────────────────────┴──────────────────────────────────┘
```

**Component nội bộ:**

```typescript
QueueStatusBadge({ status })
// Hiển thị badge màu theo trạng thái:
// uploading → xám (spinner)
// queued    → xanh nhạt
// processing → vàng (spinner + %)
// done      → xanh lá
// error     → đỏ

FilePreviewPane({ url, mimeType, fileName })
// Render preview tùy theo loại file:
// image/*        → <img>
// application/pdf → <iframe>/<embed>
// khác           → icon + tên file
```

**Toolbar:**

```
[Kéo thả / Chọn file]  [Chọn AI: Gemini 2.5 Flash | Claude Sonnet 4.5]
[Danh sách queue với progress bar]
```

---

## 5. Backend Layer

### 5.1 File Chính

| File | Vai trò |
|------|---------|
| `modules/document/document.controller.ts` | NestJS controller — routes, file validation |
| `modules/document/document.service.ts` | Business logic — CRUD, confirm, bulk actions |
| `modules/ocr/ocr-producer.service.ts` | Đẩy job vào BullMQ queue |
| `modules/ocr/processors/ocr.processor.ts` | Worker xử lý job OCR |
| `modules/ocr/providers/*.ts` | AI providers (Gemini, Claude, Local, Mock) |

### 5.2 API Endpoints

**Documents:**

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/documents/upload` | Upload file, tạo document, enqueue job |
| `GET` | `/documents/stats` | Thống kê theo trạng thái |
| `GET` | `/documents` | Danh sách + filter + pagination |
| `GET` | `/documents/:id` | Chi tiết document |
| `GET` | `/documents/:id/file` | Stream file |
| `PATCH` | `/documents/:id` | Cập nhật values/lineItems |
| `POST` | `/documents/:id/confirm` | Xác nhận → CONFIRMED |
| `POST` | `/documents/:id/transfer` | Chuyển kho → TRANSFERRED |
| `DELETE` | `/documents/:id` | Xóa (chỉ DRAFT/PROCESSED/ERROR) |
| `POST` | `/documents/bulk-confirm` | Xác nhận hàng loạt |
| `POST` | `/documents/bulk-transfer` | Chuyển hàng loạt |
| `POST` | `/documents/bulk-delete` | Xóa hàng loạt |

**Job tracking:**

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/documents/:id/job-status` | Lấy trạng thái job (one-shot) |
| `GET` | `/documents/:id/sse` | SSE stream real-time progress |

### 5.3 `DocumentService` — Luồng Tạo Mới

```typescript
async createFromUpload(params) {
  // 1. Tạo document record trong DB (status: DRAFT)
  const doc = await prisma.document.create({ ... })

  // 2. Ghi audit log "Đã tải file và đẩy vào hàng đợi OCR"
  await prisma.auditLog.create({ ... })

  // 3. Enqueue job OCR
  await ocrProducerService.enqueue({
    documentId: doc.id,
    provider: params.provider,
    schemaCode: params.schemaCode,
  })

  return doc
}
```

### 5.4 `DocumentService` — Transition States

```
DRAFT
  → (OCR xong)     → PROCESSED
  → (Xác nhận)     → CONFIRMED
  → (Chuyển kho)   → TRANSFERRED
  → (Lỗi OCR)      → ERROR

Quy tắc:
• update()  : chỉ cho phép DRAFT, PROCESSED
• confirm() : bất kỳ status
• transfer(): chỉ CONFIRMED → TRANSFERRED
• remove()  : chỉ DRAFT, PROCESSED, ERROR
```

### 5.5 SSE Stream

```typescript
streamJobEvents(documentId): Observable<SseEvent> {
  // Poll job mỗi 600ms
  // Emit:
  //   { type: 'progress', data: { progress: 45 } }
  //   { type: 'done',     data: { documentId } }
  //   { type: 'failed',   data: { reason: string } }
  // Timeout: 10 phút
}
```

---

## 6. OCR Queue & Processor

### 6.1 Queue Configuration

```typescript
// BullMQ queue: "ocr"
// Retry policy: 3 lần, exponential backoff 2s
// Job ID: "ocr-{documentId}" (dedup: không enqueue 2 lần cùng ID)
// Concurrency: env OCR_CONCURRENCY (default 3)
```

### 6.2 `OcrProcessor` — Luồng Xử Lý Job

```
Job nhận: { documentId, provider, schemaCode }
│
├─ 10% → Khởi tạo, load document từ DB
│
├─ 20% → Load schema (fields, tables, columns)
│          Build prompt từ schema definition
│
├─ 20–65% → Scan file theo loại:
│
│   PDF file:
│   ├─ Dùng pdfjs để đếm số trang
│   ├─ Tách thành từng trang (base64 PNG)
│   └─ Xử lý song song batch 5 trang
│       → AI provider.scan({ inlineContent: base64, type: 'image' })
│
│   Excel/CSV file:
│   ├─ Parse thành chunks (mỗi chunk N dòng)
│   └─ Xử lý song song batch 5 chunks
│       → AI provider.scan({ inlineContent: text, type: 'text' })
│
│   Ảnh (PNG/JPEG/GIF/WebP/TIFF):
│   └─ Đọc trực tiếp → base64
│       → AI provider.scan({ inlineContent: base64, type: 'image' })
│
│   Word (DOCX):
│   └─ Dùng mammoth extract text
│       → AI provider.scan({ inlineContent: text, type: 'text' })
│
│   Nhiều file (extraFiles):
│   └─ Xử lý tuần tự, gộp kết quả
│
├─ 70% → Merge results từ tất cả chunks/trang/file
│          Ưu tiên field có confidence cao nhất
│          Cộng dồn line items
│
└─ 100% → Lưu vào DB:
            • document_values (field key → value)
            • line_items (dòng hàng)
            • document.confidence (trung bình)
            • document.status = PROCESSED
```

---

## 7. AI Providers

### 7.1 Chọn Provider

```typescript
// Env: OCR_PROVIDER = 'gemini' | 'claude' | 'local-pdf' | 'mock'
// Hoặc người dùng chọn trực tiếp khi upload (override per-request)
```

| Provider | Model | Env Key |
|----------|-------|---------|
| `gemini` | gemini-2.5-flash | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `claude` | claude-sonnet-4-5 | `ANTHROPIC_API_KEY` |
| `local-pdf` | Regex-based (pdfjs) | — |
| `mock` | Hardcoded data | — |

### 7.2 Interface Chung

```typescript
interface IOcrProvider {
  readonly name: string;
  readonly version: string;
  scan(request: OcrRequest): Promise<OcrResult>;
}

interface OcrRequest {
  schemaCode: string;
  schemaFields: SchemaField[];
  schemaTables: SchemaTable[];
  inlineContent?: string;  // base64 (image) hoặc text (Excel/Word)
  fileUrl?: string;        // Đường dẫn file nếu không có inlineContent
  type: 'image' | 'text';
  language?: 'vi' | 'en' | 'vi+en';
}

interface OcrResult {
  fields: { key: string; value: string; confidence: number }[];
  lineItems: { [col: string]: string }[];
  confidence: number; // Trung bình
}
```

### 7.3 Prompt Strategy

**System prompt (cả Gemini và Claude):**
```
"Bạn là chuyên gia nhận dạng chứng từ kế toán Việt Nam.
Hãy trích xuất dữ liệu theo đúng schema được cung cấp.
Trả về JSON hợp lệ, không kèm giải thích."
```

**User prompt:** Gồm schema definition (tên trường, kiểu dữ liệu, mô tả) + nội dung file.

**Output JSON format:**
```json
{
  "fields": [
    { "key": "sellerName", "value": "CÔNG TY ABC", "confidence": 0.95 }
  ],
  "lineItems": [
    { "name": "Sản phẩm A", "quantity": "2", "unitPrice": "500000", "amount": "1000000" }
  ]
}
```

---

## 8. Data Models

### 8.1 Document Status Flow

```
DRAFT → PROCESSED → CONFIRMED → TRANSFERRED
                 ↘ ERROR
```

| Status | Ý nghĩa | Màu hiển thị |
|--------|---------|--------------|
| `DRAFT` | Mới tải lên, chờ/đang OCR | Xám |
| `PROCESSED` | OCR xong, chờ xác nhận | Xanh nhạt |
| `CONFIRMED` | Đã xác nhận | Xanh đậm |
| `TRANSFERRED` | Đã chuyển kho | Tím |
| `ERROR` | Lỗi OCR | Đỏ |

### 8.2 Document Types

| Code | Loại | Hiển thị |
|------|------|---------|
| `INVOICE` | Hóa đơn GTGT | Xanh |
| `RECEIPT` | Phiếu thu/chi | Cam |
| `CONTRACT` | Hợp đồng | Tím |
| `STATEMENT` | Sao kê | Xanh dương |
| `MINUTES` | Biên bản | Hồng |
| `WAREHOUSE_RECEIPT` | Phiếu kho | Xanh lá |
| `OTHERS` | Khác | Xám |

### 8.3 Schema Definition

```
SchemaDetail
├── code: string          // "HOA_DON_GTGT"
├── name: string          // "Hóa đơn giá trị gia tăng"
├── type: DocType
├── fields: SchemaField[] // Các trường header/footer
│   ├── key: string       // "sellerName", "invoiceDate"...
│   ├── label: string     // Tên hiển thị
│   ├── dataType: DataType // TEXT | DATE | NUMBER | CURRENCY | BOOLEAN | LIST
│   └── position: FieldPosition // HEADER | FOOTER | BODY
└── tables: SchemaTable[] // Bảng dòng hàng
    ├── key: string
    ├── label: string
    └── columns: SchemaTableColumn[]
        ├── key: string   // "name", "quantity", "unitPrice", "amount"
        ├── label: string
        └── dataType: DataType
```

### 8.4 DocValue & LineItem

```typescript
interface DocValue {
  fieldKey: string;
  value: string;
  confidence: number; // 0–1
}

interface LineItem {
  tableKey: string;
  rowIndex: number;
  values: Record<string, string>; // { name, quantity, unitPrice, amount }
}
```

---

## 9. Upload Constraints

| Tham số | Giá trị |
|---------|---------|
| Số file tối đa | 20 file/lần upload |
| Dung lượng tối đa | 25 MB/file |
| MIME hợp lệ | PDF, PNG, JPEG, GIF, WebP, TIFF, DOCX, XLSX, XLS, CSV |
| Retry job | 3 lần, backoff 2s |
| SSE timeout | 10 phút |
| OCR concurrency | env `OCR_CONCURRENCY` (default 3) |

---

## 10. Tích Hợp Knowledge Base

Sau khi OCR xong và xác nhận, người dùng có thể đẩy chứng từ vào bộ tri thức:

```
handleConfirmWithKb(kbId)
  → POST /documents/{id}/confirm
  → knowledgeDocumentsApi.uploadFromOcr({ documentId, kbId })
  → document status: CONFIRMED
  → Knowledge Base nhận nội dung đã extract
```

Luồng này cho phép hệ thống chatbot AI có thể truy vấn dữ liệu từ các chứng từ đã xử lý.

---

## 11. Cấu Hình Môi Trường

```env
# OCR Provider mặc định
OCR_PROVIDER=gemini          # gemini | claude | local-pdf | mock

# AI Keys
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
ANTHROPIC_API_KEY=...

# Queue
OCR_CONCURRENCY=3            # Số job chạy song song

# Storage
UPLOAD_DIR=uploads/          # Thư mục lưu file tải lên
```
