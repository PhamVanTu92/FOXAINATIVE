# TÀI LIỆU THIẾT KẾ CƠ SỞ DỮ LIỆU: HỆ THỐNG AI OCR CHỨNG TỪ

> **Mã tài liệu:** DB-OCR-01
> **Phiên bản:** 1.0
> **Công nghệ:** PostgreSQL 15+ với extension `pgvector` + Prisma ORM 5.x
> **Mục tiêu:** Lưu trữ cấu hình schema động (Dynamic Schema), quản lý vòng đời chứng từ và chuẩn bị hạ tầng dữ liệu cho Kho tri thức (Vector Search / Semantic Retrieval).

---

## 1. Thiết kế Mô hình Thực thể (Entity-Relationship Overview)

### 1.1. Sơ đồ quan hệ tổng thể

```
┌──────────────────────┐
│   DocumentSchema     │ ── Module 1: Thiết lập Schema
│  (Bộ khung mẫu)      │
└──────────┬───────────┘
           │ 1
           │
           ├──────────────────────────────┐
           │ N                            │ N
           ▼                              ▼
┌──────────────────────┐         ┌──────────────────────┐
│   DocumentField      │         │   DocumentTable      │
│  (Trường đơn)        │         │  (Bảng lặp)          │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │ 1
           │                                │
           │                                ▼ N
           │                       ┌──────────────────────┐
           │                       │ DocumentTableColumn  │
           │                       │  (Cột của bảng)      │
           │                       └──────────────────────┘
           │
           │ (định nghĩa schema)
           │
═══════════╪═════════════════════════════════════════════
           │  Module 2 & 3: Vận hành và Quản lý
═══════════╪═════════════════════════════════════════════
           │
           │            ┌──────────────────────┐
           │            │   DocumentSchema     │
           │            └──────────┬───────────┘
           │                       │ 1
           │                       │
           │                       ▼ N
           │            ┌──────────────────────┐
           │            │     Document         │ ── + embedding vector(1536)
           │            │  (Chứng từ thực tế)  │
           │            └──┬──────────┬────────┘
           │ N             │ 1        │ 1
           └───────────────┤          ├────────────┐
                           │ N        │ N          │ N
                           ▼          ▼            ▼
                  ┌──────────────┐ ┌────────────┐ ┌──────────────────┐
                  │DocumentValue │ │ Document   │ │ DocumentAuditLog │
                  │(GT trường đơn│ │ LineItem   │ │ (Vết thay đổi)   │
                  │ đã quét)     │ │(Dòng hàng) │ │                  │
                  └──────────────┘ └────────────┘ └──────────────────┘
```

### 1.2. Diễn giải các mối quan hệ

| Quan hệ | Bản chất | Mô tả nghiệp vụ |
|---|---|---|
| `DocumentSchema (1) ⟷ (N) DocumentField` | 1-N | Một schema (VD: Hóa đơn VAT) gồm nhiều trường đơn (7 trường: Số HĐ, Ngày, MST...). |
| `DocumentSchema (1) ⟷ (N) DocumentTable` | 1-N | Một schema có thể có nhiều bảng lặp (VD: bảng "Chi tiết hàng hóa"). |
| `DocumentTable (1) ⟷ (N) DocumentTableColumn` | 1-N | Mỗi bảng định nghĩa các cột (VD: 6 cột: STT, Tên hàng, ĐVT, SL, Đơn giá, Thành tiền). |
| `DocumentSchema (1) ⟷ (N) Document` | 1-N | Một schema được dùng để bóc tách nhiều chứng từ thực tế. |
| `Document (1) ⟷ (N) DocumentValue` | 1-N | Mỗi chứng từ chứa nhiều giá trị trường đơn đã quét (mỗi field 1 giá trị). |
| `Document (1) ⟷ (N) DocumentLineItem` | 1-N | Mỗi chứng từ chứa N dòng hàng hóa (line items). |
| `Document (1) ⟷ (N) DocumentAuditLog` | 1-N | Mỗi chứng từ có lịch sử thay đổi đầy đủ phục vụ audit/compliance. |

---

## 2. Định nghĩa các Kiểu Dữ liệu Đặc trưng (Enums & Types)

> Các `enum` được khai báo trong Prisma sẽ tự động được map sang `CREATE TYPE` ở PostgreSQL, đảm bảo data integrity ở tầng database.

| Enum | Giá trị | Mục đích nghiệp vụ |
|---|---|---|
| **`DocumentType`** | `INVOICE`, `RECEIPT`, `CONTRACT`, `STATEMENT`, `OTHERS` | Phân loại schema chứng từ (Hóa đơn, Phiếu thu, Hợp đồng, Bảng kê, Khác). |
| **`FieldDataType`** | `TEXT`, `DATE`, `NUMBER`, `CURRENCY` | Kiểu dữ liệu của trường OCR. Quy định cách ép kiểu (post-processing) khi AI trả về. |
| **`FieldPosition`** | `HEADER`, `FOOTER`, `BODY` | Vị trí vùng quét trên chứng từ – giúp AI khoanh vùng ROI để tăng độ chính xác. |
| **`DocumentStatus`** | `DRAFT`, `CONFIRMED`, `PROCESSED`, `ERROR` | Vòng đời chứng từ: Nháp → Đã xác nhận → Đã chuyển kho (+ trạng thái lỗi). |

---

## 3. Mã Prisma Schema Hoàn chỉnh (Prisma Data Model)

```prisma
// ============================================================================
// HỆ THỐNG AI OCR CHỨNG TỪ – PRISMA SCHEMA
// PostgreSQL 15+ với extension pgvector (vector embedding)
// ============================================================================

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

// ----------------------------------------------------------------------------
// ENUMS
// ----------------------------------------------------------------------------

enum DocumentType {
  INVOICE    // Hóa đơn
  RECEIPT    // Phiếu thu / Phiếu chi
  CONTRACT   // Hợp đồng
  STATEMENT  // Bảng kê / Sao kê
  OTHERS     // Chứng từ khác
}

enum FieldDataType {
  TEXT       // Chuỗi ký tự (VD: Số HĐ, Tên người bán)
  DATE       // Ngày tháng (VD: Ngày phát hành)
  NUMBER     // Số (VD: Số lượng, STT)
  CURRENCY   // Tiền tệ (VD: Tổng tiền, VAT)
}

enum FieldPosition {
  HEADER     // Vùng tiêu đề (đầu trang)
  FOOTER     // Vùng tổng kết (cuối trang)
  BODY       // Vùng giữa (chứa bảng lặp)
}

enum DocumentStatus {
  DRAFT      // Nháp – AI vừa quét xong, có thể sửa/xóa
  CONFIRMED  // Đã xác nhận – Người dùng đã duyệt, khóa sửa/xóa
  PROCESSED  // Đã chuyển kho – Đồng bộ ERP/Knowledge Base, bất biến
  ERROR      // Lỗi – Thiếu dữ liệu hoặc sai logic
}

// ----------------------------------------------------------------------------
// MODULE 1: THIẾT LẬP SCHEMA CHỨNG TỪ (Document Schema Configuration)
// ----------------------------------------------------------------------------

/// Bộ khung (template) định nghĩa cấu trúc một loại chứng từ
model DocumentSchema {
  id          String       @id @default(cuid())
  code        String       @unique // Mã chứng từ, ví dụ: "INVOICE-VAT-IN"
  name        String       // Tên thân thiện, VD: "Hóa đơn GTGT đầu vào"
  type        DocumentType
  description String?      @db.Text
  isActive    Boolean      @default(true) // Schema còn được sử dụng?

  createdBy   String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // Quan hệ
  fields    DocumentField[]
  tables    DocumentTable[]
  documents Document[]

  @@index([type])
  @@index([isActive])
  @@map("document_schemas")
}

/// Trường đơn (single field) trong schema – mỗi field xuất hiện 1 lần/chứng từ
model DocumentField {
  id              String        @id @default(cuid())
  schemaId        String
  fieldKey        String        // Khóa kỹ thuật, VD: "invoiceNumber", "sellerTaxCode"
  label           String        // Nhãn hiển thị, VD: "Số hóa đơn"
  dataType        FieldDataType
  position        FieldPosition
  isRequired      Boolean       @default(false)
  isUnique        Boolean       @default(false) // Có chống trùng không (VD: Số HĐ)
  validationRegex String?       // Regex validation, VD: ^[0-9\-]{10,13}$ cho MST
  description     String?
  displayOrder    Int           @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Quan hệ
  schema DocumentSchema  @relation(fields: [schemaId], references: [id], onDelete: Cascade)
  values DocumentValue[]

  @@unique([schemaId, fieldKey]) // Tránh trùng fieldKey trong cùng schema
  @@index([schemaId])
  @@index([position])
  @@map("document_fields")
}

/// Cấu hình bảng lặp (repeating table) trong schema – VD: "Chi tiết hàng hóa"
model DocumentTable {
  id           String  @id @default(cuid())
  schemaId     String
  tableKey     String  // Khóa kỹ thuật, VD: "lineItems"
  name         String  // VD: "Chi tiết hàng hóa dịch vụ"
  description  String?
  displayOrder Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Quan hệ
  schema  DocumentSchema        @relation(fields: [schemaId], references: [id], onDelete: Cascade)
  columns DocumentTableColumn[]

  @@unique([schemaId, tableKey])
  @@index([schemaId])
  @@map("document_tables")
}

/// Cột động thuộc một bảng cấu hình – VD: STT, Tên hàng, ĐVT, SL, Đơn giá, Thành tiền
model DocumentTableColumn {
  id           String        @id @default(cuid())
  tableId      String
  columnKey    String        // VD: "name", "quantity", "unitPrice"
  label        String        // VD: "Tên hàng hóa/dịch vụ"
  dataType     FieldDataType
  isRequired   Boolean       @default(false)
  displayOrder Int           @default(0)

  // Quan hệ
  table DocumentTable @relation(fields: [tableId], references: [id], onDelete: Cascade)

  @@unique([tableId, columnKey])
  @@index([tableId])
  @@map("document_table_columns")
}

// ----------------------------------------------------------------------------
// MODULE 2 & 3: CHỨNG TỪ THỰC TẾ + LƯU TRỮ + VECTOR EMBEDDING
// ----------------------------------------------------------------------------

/// Chứng từ thực tế đã được tải lên và bóc tách bởi AI OCR
model Document {
  id              String         @id @default(cuid())
  schemaId        String
  schemaCode      String         // Denormalize để filter nhanh không cần JOIN

  // ----- Thông tin file gốc -----
  fileUrl         String         // Đường dẫn lưu trữ (S3/MinIO)
  fileName        String?
  fileSize        Int?           // Đơn vị: bytes
  mimeType        String?        // VD: application/pdf, image/jpeg

  // ----- 4 trường Header (denormalized – phục vụ filter & search nhanh) -----
  invoiceNumber   String?        // Số hóa đơn
  issueDate       DateTime?      @db.Date
  sellerTaxCode   String?        // Mã số thuế người bán
  sellerName      String?

  // ----- 3 trường Footer (denormalized) -----
  totalAmount     Decimal?       @db.Decimal(18, 2) // Tổng tiền hàng
  vatAmount       Decimal?       @db.Decimal(18, 2) // Tiền thuế VAT
  grandTotal      Decimal?       @db.Decimal(18, 2) // Tổng thanh toán

  // ----- Metadata OCR -----
  status          DocumentStatus @default(DRAFT)
  ocrConfidence   Float?         // Độ tin cậy trung bình toàn chứng từ (0-1)
  ocrLanguage     String?        // VD: "vi", "en", "vi+en"
  ocrEngineVersion String?       // Phiên bản AI engine đã quét

  // ----- Vector Embedding cho Kho tri thức (semantic search) -----
  embedding       Unsupported("vector(1536)")?
  embeddingModel  String?        // VD: "text-embedding-3-small"
  embeddedAt      DateTime?

  // ----- Audit / Lifecycle -----
  createdBy       String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  confirmedBy     String?
  confirmedAt     DateTime?
  processedBy     String?
  processedAt     DateTime?      // Thời điểm chuyển vào Kho tri thức

  // Quan hệ
  schema    DocumentSchema     @relation(fields: [schemaId], references: [id])
  values    DocumentValue[]
  lineItems DocumentLineItem[]
  auditLogs DocumentAuditLog[]

  // Ràng buộc chống trùng hóa đơn: cặp (MST người bán + Số HĐ) là duy nhất
  @@unique([sellerTaxCode, invoiceNumber], name: "uq_seller_invoice")
  @@index([status])
  @@index([createdAt])
  @@index([schemaCode])
  @@index([invoiceNumber])
  @@index([sellerTaxCode])
  @@index([issueDate])
  @@index([schemaId, status])             // Composite: filter "Loại x Trạng thái"
  @@index([status, createdAt(sort: Desc)]) // Composite: list view sắp xếp mới nhất
  @@map("documents")
}

/// Giá trị thực tế của trường đơn (single field value) sau khi AI quét
model DocumentValue {
  id          String  @id @default(cuid())
  documentId  String
  fieldId     String
  stringValue String? @db.Text // Lưu thô dạng string, ép kiểu khi đọc

  // ----- Bounding box: vị trí AI quét được trên ảnh (px hoặc tỷ lệ 0-1) -----
  bboxX       Float?
  bboxY       Float?
  bboxWidth   Float?
  bboxHeight  Float?
  pageNumber  Int?    // Trang chứa giá trị (nếu PDF nhiều trang)

  confidence       Float?
  isManuallyEdited Boolean @default(false) // Người dùng đã sửa tay?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Quan hệ
  document Document      @relation(fields: [documentId], references: [id], onDelete: Cascade)
  field    DocumentField @relation(fields: [fieldId], references: [id], onDelete: Restrict)

  @@unique([documentId, fieldId]) // Mỗi field chỉ có 1 giá trị/chứng từ
  @@index([documentId])
  @@index([fieldId])
  @@map("document_values")
}

/// Dòng hàng (line item) của chứng từ – mỗi mặt hàng/dịch vụ là 1 record
model DocumentLineItem {
  id         String  @id @default(cuid())
  documentId String
  stt        Int     // Số thứ tự dòng (1, 2, 3...)

  // ----- 6 cột nghiệp vụ chuẩn của Hóa đơn VAT -----
  name       String? @db.Text                        // Tên hàng hóa/dịch vụ
  unit       String?                                 // Đơn vị tính
  quantity   Decimal? @db.Decimal(18, 4)             // Số lượng
  unitPrice  Decimal? @db.Decimal(18, 2)             // Đơn giá
  amount     Decimal? @db.Decimal(18, 2)             // Thành tiền

  // ----- Cột mở rộng (dynamic) cho các loại chứng từ khác -----
  extraData  Json?    // VD: { "discount": 5000, "category": "vatphamvanphong" }

  isManuallyAdded Boolean @default(false) // Người dùng dùng "+ Thêm dòng"?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Quan hệ
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, stt])
  @@index([documentId])
  @@map("document_line_items")
}

// ----------------------------------------------------------------------------
// AUDIT LOG: GHI VẾT MỌI THAY ĐỔI – PHỤC VỤ COMPLIANCE & TRACEABILITY
// ----------------------------------------------------------------------------

/// Vết lịch sử mọi thay đổi trên chứng từ: chỉnh sửa inline, đổi trạng thái, revert
model DocumentAuditLog {
  id         String          @id @default(cuid())
  documentId String
  action     String          // CREATE | EDIT_FIELD | EDIT_LINE_ITEM | STATUS_CHANGE | REVERT | DELETE | EXPORT | PUSH_KB

  // ----- Thay đổi field -----
  fieldName  String?         // Tên trường bị thay đổi (VD: "invoiceNumber")
  oldValue   String?         @db.Text
  newValue   String?         @db.Text

  // ----- Thay đổi trạng thái -----
  oldStatus  DocumentStatus?
  newStatus  DocumentStatus?

  // ----- Context -----
  changedBy  String          // User ID thực hiện
  changedAt  DateTime        @default(now())
  note       String?         @db.Text
  ipAddress  String?
  userAgent  String?

  // Quan hệ
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([changedAt(sort: Desc)])
  @@index([changedBy])
  @@index([action])
  @@map("document_audit_logs")
}
```

> **📌 Lưu ý triển khai pgvector:**
> Trước khi `prisma migrate dev`, cần bật extension trong PostgreSQL:
> ```sql
> CREATE EXTENSION IF NOT EXISTS vector;
> ```
> Sau khi migrate, tạo index HNSW cho cột `embedding` để tăng tốc tìm kiếm:
> ```sql
> CREATE INDEX documents_embedding_idx ON documents
> USING hnsw (embedding vector_cosine_ops);
> ```

---

## 4. Chi tiết Từ điển Dữ liệu (Data Dictionary)

### 4.1. Bảng `document_schemas`

| Tên trường | Kiểu (PostgreSQL) | Thuộc tính | Mô tả nghiệp vụ |
|---|---|---|---|
| `id` | `TEXT` | PK | Khóa chính – CUID. |
| `code` | `TEXT` | UNIQUE, NOT NULL | Mã chứng từ định danh (VD: `INVOICE-VAT-IN`). |
| `name` | `TEXT` | NOT NULL | Tên thân thiện hiển thị cho người dùng. |
| `type` | `DocumentType` | NOT NULL | Phân loại schema (Enum). |
| `description` | `TEXT` | NULLABLE | Ghi chú phạm vi sử dụng. |
| `isActive` | `BOOLEAN` | DEFAULT TRUE | Cờ kích hoạt/vô hiệu hóa schema. |
| `createdBy` | `TEXT` | NULLABLE | User tạo schema. |
| `createdAt` | `TIMESTAMP` | DEFAULT NOW() | Ngày tạo. |
| `updatedAt` | `TIMESTAMP` | AUTO UPDATE | Ngày cập nhật cuối. |

### 4.2. Bảng `document_fields`

| Tên trường | Kiểu (PostgreSQL) | Thuộc tính | Mô tả nghiệp vụ |
|---|---|---|---|
| `id` | `TEXT` | PK | Khóa chính. |
| `schemaId` | `TEXT` | FK → `document_schemas.id`, ON DELETE CASCADE | Schema sở hữu trường. |
| `fieldKey` | `TEXT` | NOT NULL, UNIQUE (schemaId, fieldKey) | Khóa kỹ thuật (VD: `invoiceNumber`). |
| `label` | `TEXT` | NOT NULL | Nhãn hiển thị (VD: "Số hóa đơn"). |
| `dataType` | `FieldDataType` | NOT NULL | TEXT / DATE / NUMBER / CURRENCY. |
| `position` | `FieldPosition` | NOT NULL | HEADER / FOOTER / BODY. |
| `isRequired` | `BOOLEAN` | DEFAULT FALSE | Bắt buộc nhập? |
| `isUnique` | `BOOLEAN` | DEFAULT FALSE | Có chống trùng không (Số HĐ = TRUE). |
| `validationRegex` | `TEXT` | NULLABLE | Regex hậu kiểm (VD: `^[0-9\-]{10,13}$`). |
| `displayOrder` | `INT` | DEFAULT 0 | Thứ tự hiển thị trên UI. |

> **Ví dụ dữ liệu 7 trường đơn của Hóa đơn VAT:**
> | fieldKey | label | dataType | position | isRequired | isUnique |
> |---|---|---|---|---|---|
> | `invoiceNumber` | Số hóa đơn | TEXT | HEADER | true | true |
> | `issueDate` | Ngày phát hành | DATE | HEADER | true | false |
> | `sellerTaxCode` | Mã số thuế người bán | TEXT | HEADER | true | false |
> | `sellerName` | Tên người bán | TEXT | HEADER | true | false |
> | `totalAmount` | Tổng tiền hàng | CURRENCY | FOOTER | true | false |
> | `vatAmount` | Tiền thuế VAT | CURRENCY | FOOTER | true | false |
> | `grandTotal` | Tổng thanh toán | CURRENCY | FOOTER | true | false |

### 4.3. Bảng `document_tables`

| Tên trường | Kiểu (PostgreSQL) | Thuộc tính | Mô tả nghiệp vụ |
|---|---|---|---|
| `id` | `TEXT` | PK | Khóa chính. |
| `schemaId` | `TEXT` | FK → `document_schemas.id`, CASCADE | Schema sở hữu. |
| `tableKey` | `TEXT` | NOT NULL, UNIQUE (schemaId, tableKey) | Khóa kỹ thuật bảng (VD: `lineItems`). |
| `name` | `TEXT` | NOT NULL | Tên bảng (VD: "Chi tiết hàng hóa dịch vụ"). |
| `description` | `TEXT` | NULLABLE | Mô tả mục đích bảng. |
| `displayOrder` | `INT` | DEFAULT 0 | Thứ tự hiển thị. |

### 4.4. Bảng `document_table_columns`

| Tên trường | Kiểu (PostgreSQL) | Thuộc tính | Mô tả nghiệp vụ |
|---|---|---|---|
| `id` | `TEXT` | PK | Khóa chính. |
| `tableId` | `TEXT` | FK → `document_tables.id`, CASCADE | Bảng sở hữu cột. |
| `columnKey` | `TEXT` | NOT NULL, UNIQUE (tableId, columnKey) | Khóa kỹ thuật cột (VD: `unitPrice`). |
| `label` | `TEXT` | NOT NULL | Tiêu đề cột (VD: "Đơn giá"). |
| `dataType` | `FieldDataType` | NOT NULL | Kiểu dữ liệu cột. |
| `isRequired` | `BOOLEAN` | DEFAULT FALSE | Cột bắt buộc? |
| `displayOrder` | `INT` | DEFAULT 0 | Thứ tự cột. |

> **Ví dụ dữ liệu 6 cột bảng "Chi tiết hàng hóa":**
> | columnKey | label | dataType | isRequired |
> |---|---|---|---|
> | `stt` | STT | NUMBER | true |
> | `name` | Tên hàng hóa/dịch vụ | TEXT | true |
> | `unit` | ĐVT | TEXT | false |
> | `quantity` | Số lượng | NUMBER | true |
> | `unitPrice` | Đơn giá | NUMBER | true |
> | `amount` | Thành tiền | NUMBER | true |

### 4.5. Bảng `documents`

| Tên trường | Kiểu (PostgreSQL) | Thuộc tính | Mô tả nghiệp vụ |
|---|---|---|---|
| `id` | `TEXT` | PK | Khóa chính. |
| `schemaId` | `TEXT` | FK → `document_schemas.id`, RESTRICT | Schema áp dụng. |
| `schemaCode` | `TEXT` | INDEX | Mã schema (denormalize để tránh JOIN khi filter). |
| `fileUrl` | `TEXT` | NOT NULL | Đường dẫn file gốc (S3/MinIO). |
| `fileName` | `TEXT` | NULLABLE | Tên file upload gốc. |
| `fileSize` | `INT` | NULLABLE | Dung lượng (bytes). |
| `mimeType` | `TEXT` | NULLABLE | Loại MIME (`application/pdf`, `image/jpeg`...). |
| `invoiceNumber` | `TEXT` | INDEX | Số hóa đơn (denormalize cho filter/search). |
| `issueDate` | `DATE` | INDEX | Ngày phát hành. |
| `sellerTaxCode` | `TEXT` | INDEX | MST người bán (denormalize). |
| `sellerName` | `TEXT` | NULLABLE | Tên người bán. |
| `totalAmount` | `DECIMAL(18,2)` | NULLABLE | Tổng tiền hàng. |
| `vatAmount` | `DECIMAL(18,2)` | NULLABLE | Tiền thuế VAT. |
| `grandTotal` | `DECIMAL(18,2)` | NULLABLE | Tổng thanh toán. |
| `status` | `DocumentStatus` | DEFAULT 'DRAFT', INDEX | Trạng thái vòng đời. |
| `ocrConfidence` | `FLOAT` | NULLABLE | Độ tin cậy AI (0-1). |
| `ocrLanguage` | `TEXT` | NULLABLE | Ngôn ngữ OCR. |
| `ocrEngineVersion` | `TEXT` | NULLABLE | Version AI engine. |
| `embedding` | `vector(1536)` | NULLABLE | **Vector ngữ nghĩa cho Kho tri thức.** |
| `embeddingModel` | `TEXT` | NULLABLE | Model sinh embedding. |
| `embeddedAt` | `TIMESTAMP` | NULLABLE | Thời điểm sinh embedding. |
| `createdBy` | `TEXT` | NULLABLE | User upload. |
| `createdAt` | `TIMESTAMP` | DEFAULT NOW(), INDEX | Thời điểm tạo. |
| `confirmedBy` | `TEXT` | NULLABLE | User xác nhận. |
| `confirmedAt` | `TIMESTAMP` | NULLABLE | Thời điểm chuyển CONFIRMED. |
| `processedBy` | `TEXT` | NULLABLE | User chuyển kho. |
| `processedAt` | `TIMESTAMP` | NULLABLE | Thời điểm chuyển PROCESSED. |

> **Ràng buộc duy nhất:** `UNIQUE(sellerTaxCode, invoiceNumber)` – chống trùng hóa đơn.

### 4.6. Bảng `document_values`

| Tên trường | Kiểu (PostgreSQL) | Thuộc tính | Mô tả nghiệp vụ |
|---|---|---|---|
| `id` | `TEXT` | PK | Khóa chính. |
| `documentId` | `TEXT` | FK → `documents.id`, CASCADE | Chứng từ chứa giá trị. |
| `fieldId` | `TEXT` | FK → `document_fields.id`, RESTRICT | Field tương ứng. |
| `stringValue` | `TEXT` | NULLABLE | Giá trị thô dạng string. |
| `bboxX` / `bboxY` | `FLOAT` | NULLABLE | Tọa độ vùng quét (cho icon định vị 📍). |
| `bboxWidth` / `bboxHeight` | `FLOAT` | NULLABLE | Kích thước bounding box. |
| `pageNumber` | `INT` | NULLABLE | Trang PDF chứa giá trị. |
| `confidence` | `FLOAT` | NULLABLE | Độ tin cậy của riêng trường (🟢/🟡/🔴). |
| `isManuallyEdited` | `BOOLEAN` | DEFAULT FALSE | Đánh dấu nếu người dùng sửa tay. |

> **Ràng buộc duy nhất:** `UNIQUE(documentId, fieldId)` – mỗi field chỉ 1 giá trị/chứng từ.

### 4.7. Bảng `document_line_items`

| Tên trường | Kiểu (PostgreSQL) | Thuộc tính | Mô tả nghiệp vụ |
|---|---|---|---|
| `id` | `TEXT` | PK | Khóa chính. |
| `documentId` | `TEXT` | FK → `documents.id`, CASCADE | Chứng từ sở hữu dòng hàng. |
| `stt` | `INT` | NOT NULL, UNIQUE (documentId, stt) | Số thứ tự dòng. |
| `name` | `TEXT` | NULLABLE | Tên hàng hóa/dịch vụ. |
| `unit` | `TEXT` | NULLABLE | Đơn vị tính. |
| `quantity` | `DECIMAL(18,4)` | NULLABLE | Số lượng (4 chữ số thập phân). |
| `unitPrice` | `DECIMAL(18,2)` | NULLABLE | Đơn giá VND. |
| `amount` | `DECIMAL(18,2)` | NULLABLE | Thành tiền = SL × Đơn giá. |
| `extraData` | `JSONB` | NULLABLE | Dữ liệu mở rộng cho schema khác (VD: chiết khấu). |
| `isManuallyAdded` | `BOOLEAN` | DEFAULT FALSE | Đánh dấu dòng do "+ Thêm dòng". |

### 4.8. Bảng `document_audit_logs`

| Tên trường | Kiểu (PostgreSQL) | Thuộc tính | Mô tả nghiệp vụ |
|---|---|---|---|
| `id` | `TEXT` | PK | Khóa chính. |
| `documentId` | `TEXT` | FK → `documents.id`, CASCADE | Chứng từ liên quan. |
| `action` | `TEXT` | NOT NULL, INDEX | Loại hành động: `CREATE`, `EDIT_FIELD`, `STATUS_CHANGE`, `REVERT`, `EXPORT`, `PUSH_KB`, `DELETE`. |
| `fieldName` | `TEXT` | NULLABLE | Tên trường bị sửa. |
| `oldValue` / `newValue` | `TEXT` | NULLABLE | Giá trị cũ / mới. |
| `oldStatus` / `newStatus` | `DocumentStatus` | NULLABLE | Trạng thái cũ / mới. |
| `changedBy` | `TEXT` | NOT NULL, INDEX | User thực hiện. |
| `changedAt` | `TIMESTAMP` | DEFAULT NOW(), INDEX | Thời điểm. |
| `note` | `TEXT` | NULLABLE | Lý do thay đổi. |
| `ipAddress` / `userAgent` | `TEXT` | NULLABLE | Context bảo mật. |

---

## 5. Chiến lược Đánh Chỉ mục (Indexing Strategy) & Ràng buộc Tính toàn vẹn

### 5.1. Bảng tổng hợp các Index quan trọng

| Bảng | Index | Loại | Mục đích sử dụng |
|---|---|---|---|
| `documents` | `idx_documents_status` | B-Tree | Filter theo trạng thái (`Nháp / Đã xác nhận / Đã chuyển kho`). |
| `documents` | `idx_documents_created_at` | B-Tree | Sắp xếp theo ngày tạo mới nhất. |
| `documents` | `idx_documents_schema_code` | B-Tree | Filter theo loại chứng từ. |
| `documents` | `idx_documents_invoice_number` | B-Tree | Tìm kiếm theo Số hóa đơn (Universal Search). |
| `documents` | `idx_documents_seller_tax_code` | B-Tree | Tìm theo MST nhà cung cấp. |
| `documents` | `idx_documents_issue_date` | B-Tree | Filter Date Range. |
| `documents` | `idx_documents_schema_status` | Composite (B-Tree) | Filter kết hợp "Loại × Trạng thái" (Section 3.2 BA doc). |
| `documents` | `idx_documents_status_created` | Composite (B-Tree) | Danh sách mặc định: lọc trạng thái + sắp xếp mới nhất. |
| `documents` | `uq_seller_invoice` | Unique | **Chống trùng hóa đơn cùng nhà cung cấp.** |
| `documents` | `documents_embedding_idx` | **HNSW (pgvector)** | Tìm kiếm ngữ nghĩa (Semantic Search) trong Kho tri thức. |
| `document_audit_logs` | `idx_audit_changed_at` | B-Tree | Tra cứu lịch sử theo thời gian giảm dần. |

### 5.2. Lý do nghiệp vụ của các Index

#### 5.2.1. Phục vụ "Tìm kiếm thông minh" (Universal Search)
- `invoiceNumber`, `sellerTaxCode`, `schemaCode` được index riêng → tìm kiếm full-text với prefix matching hoặc exact match đều nhanh (< 50ms).
- Có thể bổ sung **PostgreSQL GIN index** cho `to_tsvector('vietnamese', sellerName)` nếu cần fuzzy search tên nhà cung cấp:
  ```sql
  CREATE INDEX idx_documents_seller_name_fts ON documents
  USING gin (to_tsvector('simple', seller_name));
  ```

#### 5.2.2. Phục vụ "Bộ lọc kết hợp" (Combined Filter)
- Composite index `(schemaId, status)` tối ưu cho truy vấn:
  ```sql
  SELECT * FROM documents
  WHERE schema_id = 'xxx' AND status = 'DRAFT'
  ORDER BY created_at DESC;
  ```
- Composite index `(status, createdAt DESC)` tối ưu cho **list view mặc định** ở Module 3 (Quản lý chứng từ).

#### 5.2.3. Phục vụ Semantic Search (Kho tri thức)
- Cột `embedding vector(1536)` dùng để lưu vector của nội dung chứng từ.
- Index **HNSW** (Hierarchical Navigable Small World) tối ưu hơn IVFFlat khi dataset lớn, cho tốc độ truy vấn `ORDER BY embedding <=> $query_vector LIMIT 10` chỉ vài ms.
  ```sql
  CREATE INDEX documents_embedding_idx ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```

### 5.3. Ràng buộc Tính toàn vẹn dữ liệu (Data Integrity Constraints)

| Ràng buộc | Cấp độ | Mô tả |
|---|---|---|
| `UNIQUE(sellerTaxCode, invoiceNumber)` | DB-level | **Chống trùng hóa đơn:** Một nhà cung cấp không thể phát hành 2 hóa đơn cùng số. |
| `UNIQUE(schemaId, fieldKey)` | DB-level | Không cho phép 2 field cùng `fieldKey` trong cùng schema. |
| `UNIQUE(documentId, fieldId)` | DB-level | Mỗi chứng từ chỉ có 1 giá trị/field. |
| `UNIQUE(documentId, stt)` | DB-level | Số thứ tự dòng hàng không trùng trong cùng chứng từ. |
| `FK ON DELETE CASCADE` | DB-level | Xóa schema → xóa kéo theo fields/tables; Xóa document → xóa values/lineItems/auditLogs. |
| `FK ON DELETE RESTRICT` (document → schema) | DB-level | Không cho phép xóa schema khi còn chứng từ tham chiếu (bảo toàn dữ liệu lịch sử). |
| `CHECK: totalAmount + vatAmount = grandTotal` | App-level (Service) | Validate logic số học – không enforce ở DB vì có sai số làm tròn. |
| `CHECK: status ∈ Enum` | DB-level (Enum) | PostgreSQL native enum đảm bảo giá trị hợp lệ. |

### 5.4. Khuyến nghị vận hành (Operational Recommendations)

> **🔧 Bảo trì định kỳ:**
> - Chạy `VACUUM ANALYZE documents` hàng tuần để cập nhật thống kê cho query planner.
> - Reindex `documents_embedding_idx` định kỳ khi insert > 100k records mới.
> - Phân vùng (partitioning) bảng `documents` theo tháng (`createdAt`) nếu dataset vượt 10M records.

> **🔐 Bảo mật & Audit:**
> - Bảng `document_audit_logs` **không bao giờ** cho phép `UPDATE` / `DELETE` ở tầng app – chỉ INSERT.
> - Triển khai row-level security (RLS) nếu hệ thống multi-tenant.

> **📊 Tích hợp hệ thống:**
> - Khi chứng từ chuyển sang `PROCESSED`, trigger job nền (background worker) để:
>   1. Đẩy file + metadata sang DMS.
>   2. Gọi API sinh embedding (OpenAI/Anthropic embedding model) và lưu vào cột `embedding`.
>   3. Đồng bộ master data sang ERP qua message queue.

---

> 📌 **Tài liệu liên quan:**
> - [[Thiet_lap_Chung_tu_OCR]] – Quy ước nghiệp vụ các trường mà schema này phản ánh.
> - [[Nhan_dang_Chung_tu_OCR]] – Quy trình tạo ra dữ liệu lưu vào bảng `documents`.
> - [[Quan_ly_Chung_tu_OCR]] – Vòng đời `DocumentStatus` và tính năng Export/Knowledge Base.
