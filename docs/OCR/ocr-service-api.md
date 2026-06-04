# OCR Service — Hướng Dẫn Sử Dụng API

## Thông Tin Chung

| Thuộc tính | Giá trị |
|------------|---------|
| Base URL | `http://localhost:3001/api/ocr` |
| Env variable | `NEXT_PUBLIC_API_URL` (web portal) |
| Content-Type | `application/json` (trừ upload dùng `multipart/form-data`) |
| Xác thực | Bearer Token (header `Authorization: Bearer <token>`) |

> Tất cả path dưới đây đều được prepend bằng Base URL.  
> Ví dụ: `GET /documents` → `GET http://localhost:3001/api/ocr/documents`

---

## Enum & Kiểu Dữ Liệu

### DocStatus
```
DRAFT        Mới tạo / đang chờ OCR
PROCESSED    OCR hoàn thành, chờ xác nhận
CONFIRMED    Đã xác nhận
TRANSFERRED  Đã chuyển kho tri thức
ERROR        Lỗi OCR
```

### DocType
```
INVOICE            Hóa đơn GTGT
RECEIPT            Phiếu thu / chi
CONTRACT           Hợp đồng
STATEMENT          Sao kê
MINUTES            Biên bản
WAREHOUSE_RECEIPT  Phiếu kho
OTHERS             Khác
```

### DataType
```
TEXT       Văn bản
DATE       Ngày tháng (YYYY-MM-DD)
NUMBER     Số nguyên / thực
CURRENCY   Tiền tệ (số)
BOOLEAN    true / false
LIST       Danh sách (chuỗi phân cách bằng dấu phẩy)
```

### FieldPosition
```
HEADER  Thông tin phần đầu chứng từ
BODY    Thông tin phần thân
FOOTER  Thông tin phần cuối
```

### OcrProvider
```
gemini     Gemini 2.5 Flash  (mặc định)
claude     Claude Sonnet 4.5
local-pdf  Regex-based (PDF text)
mock       Dữ liệu giả (dev/test)
```

---

## I. DOCUMENTS API

### 1. Upload & Nhận Dạng

#### `POST /documents/upload`

Tải file lên và đẩy vào hàng đợi OCR.

**Request:** `multipart/form-data`

| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `files` | File[] | ✓ | Tối đa 20 file, mỗi file ≤ 25 MB |
| `schemaId` | string (UUID) | | ID schema áp dụng |
| `language` | `vi` \| `en` \| `vi+en` | | Ngôn ngữ chứng từ (default: `vi`) |
| `ocrProvider` | OcrProvider | | Provider AI (default: `gemini`) |

**MIME hợp lệ:** PDF, PNG, JPEG, GIF, WebP, TIFF, DOCX, XLSX, XLS, CSV

**Response `201`:**
```json
[
  {
    "id": "uuid",
    "fileName": "invoice.pdf",
    "mimeType": "application/pdf",
    "status": "DRAFT",
    "schemaCode": "HOA_DON_GTGT",
    "createdAt": "2026-06-03T10:00:00.000Z"
  }
]
```

**Lỗi thường gặp:**

| Code | Mô tả |
|------|-------|
| `400` | Không có file / MIME không hợp lệ |
| `413` | File vượt quá 25 MB |

---

### 2. Thống Kê

#### `GET /documents/stats`

**Response `200`:**
```json
{
  "total": 61,
  "draft": 35,
  "processed": 2,
  "confirmed": 9,
  "transferred": 11,
  "error": 4
}
```

---

### 3. Danh Sách Chứng Từ

#### `GET /documents`

**Query Parameters:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `search` | string | Tìm theo mã CT, tên file, người bán |
| `status` | DocStatus[] | Lọc theo trạng thái (nhiều giá trị) |
| `schemaCode` | string | Lọc theo mã schema |
| `type` | DocType | Lọc theo loại chứng từ |
| `sellerTaxCode` | string | Lọc theo mã số thuế người bán |
| `dateFrom` | string (YYYY-MM-DD) | Từ ngày OCR |
| `dateTo` | string (YYYY-MM-DD) | Đến ngày OCR |
| `page` | number | Trang hiện tại (default: 1) |
| `pageSize` | number | Số item/trang (default: 20) |

**Ví dụ:**
```
GET /documents?status=PROCESSED&status=CONFIRMED&dateFrom=2026-06-01&page=1&pageSize=20
```

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "code": "INV5",
      "fileName": "INVOICE.jpg",
      "mimeType": "image/jpeg",
      "status": "CONFIRMED",
      "type": "INVOICE",
      "schemaCode": "HOA_DON_GTGT",
      "schemaName": "Hóa đơn GTGT",
      "confidence": 0.95,
      "ocrProvider": "gemini",
      "createdAt": "2026-06-03T09:00:00.000Z",
      "updatedAt": "2026-06-03T09:05:00.000Z",
      "processedAt": "2026-06-03T09:01:00.000Z"
    }
  ],
  "total": 61,
  "page": 1,
  "pageSize": 20,
  "totalPages": 4
}
```

---

### 4. Chi Tiết Chứng Từ

#### `GET /documents/:id`

**Response `200`:**
```json
{
  "id": "uuid",
  "code": "INV5",
  "fileName": "INVOICE.jpg",
  "mimeType": "image/jpeg",
  "status": "PROCESSED",
  "type": "INVOICE",
  "confidence": 0.95,
  "schema": {
    "id": "uuid",
    "code": "HOA_DON_GTGT",
    "name": "Hóa đơn giá trị gia tăng",
    "fields": [
      {
        "id": "uuid",
        "key": "sellerName",
        "label": "Tên người bán",
        "dataType": "TEXT",
        "position": "HEADER",
        "isRequired": true,
        "displayOrder": 1
      }
    ],
    "tables": [
      {
        "id": "uuid",
        "key": "lineItems",
        "name": "Danh sách hàng hóa",
        "columns": [
          { "id": "uuid", "key": "name",      "label": "Tên hàng",    "dataType": "TEXT"     },
          { "id": "uuid", "key": "unit",      "label": "ĐVT",         "dataType": "TEXT"     },
          { "id": "uuid", "key": "quantity",  "label": "Số lượng",    "dataType": "NUMBER"   },
          { "id": "uuid", "key": "unitPrice", "label": "Đơn giá",     "dataType": "CURRENCY" },
          { "id": "uuid", "key": "amount",    "label": "Thành tiền",  "dataType": "CURRENCY" }
        ]
      }
    ]
  },
  "values": [
    { "fieldKey": "sellerName",  "value": "CÔNG TY ABC",     "confidence": 0.97 },
    { "fieldKey": "invoiceDate", "value": "2026-05-21",       "confidence": 0.99 },
    { "fieldKey": "totalAmount", "value": "6500000",          "confidence": 0.95 }
  ],
  "lineItems": [
    {
      "tableKey": "lineItems",
      "rowIndex": 0,
      "values": {
        "name":      "Pin Siemens MAG8000",
        "unit":      "Bộ",
        "quantity":  "2",
        "unitPrice": "3250000",
        "amount":    "6500000"
      }
    }
  ],
  "auditLogs": [
    {
      "action": "Đã tải file và đẩy vào hàng đợi OCR",
      "actor": "system",
      "createdAt": "2026-06-03T09:00:00.000Z"
    }
  ],
  "extraFileUrls": [],
  "createdAt": "2026-06-03T09:00:00.000Z"
}
```

---

### 5. Xem File

#### `GET /documents/:id/file`

Stream file gốc về client.

**Query Parameters:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `extra` | number | Index file phụ (0-based). Bỏ qua để lấy file chính |

**Response:** Binary stream với `Content-Type` và `Content-Disposition` phù hợp.

---

### 6. Cập Nhật Chứng Từ

#### `PATCH /documents/:id`

Cập nhật giá trị trường và dòng hàng. Chỉ áp dụng khi status là `DRAFT` hoặc `PROCESSED`.

**Request Body:**
```json
{
  "values": [
    { "fieldKey": "sellerName",  "value": "CÔNG TY XYZ"  },
    { "fieldKey": "totalAmount", "value": "7000000"       }
  ],
  "lineItems": [
    {
      "tableKey":  "lineItems",
      "rowIndex":  0,
      "name":      "Pin Siemens MAG8000",
      "unit":      "Bộ",
      "quantity":  "2",
      "unitPrice": "3500000",
      "amount":    "7000000"
    }
  ],
  "status": "DRAFT"
}
```

> Truyền `"status": "DRAFT"` để hạ trạng thái từ `PROCESSED` về `DRAFT`.

**Response `200`:** Document đã cập nhật (same format as GET /documents/:id)

---

### 7. Xác Nhận Chứng Từ

#### `POST /documents/:id/confirm`

Chuyển status → `CONFIRMED`.

**Request Body:**
```json
{
  "note": "Đã kiểm tra và xác nhận" 
}
```
> `note` là tùy chọn, tối đa 1000 ký tự.

**Response `200`:**
```json
{ "id": "uuid", "status": "CONFIRMED" }
```

---

### 8. Chuyển Kho

#### `POST /documents/:id/transfer`

Chuyển document từ `CONFIRMED` → `TRANSFERRED` (đẩy vào kho tri thức).

**Request Body:** Không cần body.

**Response `200`:**
```json
{ "id": "uuid", "status": "TRANSFERRED" }
```

---

### 9. Xóa Chứng Từ

#### `DELETE /documents/:id`

Chỉ xóa được khi status là `DRAFT`, `PROCESSED`, hoặc `ERROR`.

**Response `200`:**
```json
{ "message": "Đã xóa thành công" }
```

**Lỗi:**

| Code | Mô tả |
|------|-------|
| `400` | Không thể xóa document đã CONFIRMED hoặc TRANSFERRED |
| `404` | Không tìm thấy document |

---

### 10. Hành Động Hàng Loạt

#### `POST /documents/bulk-confirm`

```json
{ "documentIds": ["uuid1", "uuid2", "uuid3"] }
```

**Response `200`:**
```json
{ "confirmed": 3, "skipped": 0 }
```

---

#### `POST /documents/bulk-transfer`

```json
{ "documentIds": ["uuid1", "uuid2"] }
```

**Response `200`:**
```json
{ "transferred": 2, "skipped": 0 }
```

---

#### `POST /documents/bulk-delete`

```json
{ "documentIds": ["uuid1", "uuid4"] }
```

**Response `200`:**
```json
{ "deleted": 2, "skipped": 0 }
```

---

### 11. Theo Dõi Tiến Trình OCR (Real-time)

#### `GET /documents/:id/job-status`

Lấy trạng thái job một lần (one-shot).

**Response `200`:**
```json
{
  "state":    "active",
  "progress": 45,
  "failedReason": null
}
```

> Các giá trị `state`: `waiting` | `active` | `completed` | `failed`

---

#### `GET /documents/:id/sse`

**Server-Sent Events** — theo dõi tiến trình OCR theo thời gian thực.

**Headers cần gửi:**
```
Accept: text/event-stream
Cache-Control: no-cache
```

**Các event nhận được:**

```
event: progress
data: {"progress": 45, "documentId": "uuid"}

event: done
data: {"documentId": "uuid", "status": "PROCESSED"}

event: failed
data: {"documentId": "uuid", "reason": "Lỗi kết nối API"}
```

**Ví dụ sử dụng (JavaScript):**
```javascript
const es = new EventSource(`/api/ocr/documents/${id}/sse`);

es.addEventListener('progress', (e) => {
  const { progress } = JSON.parse(e.data);
  console.log(`Đang xử lý: ${progress}%`);
});

es.addEventListener('done', (e) => {
  const { documentId } = JSON.parse(e.data);
  es.close();
  // Tải chi tiết document
  fetchDocument(documentId);
});

es.addEventListener('failed', (e) => {
  const { reason } = JSON.parse(e.data);
  es.close();
  console.error('OCR thất bại:', reason);
});
```

> SSE tự đóng sau **10 phút** nếu không nhận được event `done` hoặc `failed`.

---

## II. SCHEMAS API

### 1. Thống Kê Schema

#### `GET /schemas/stats`

**Response `200`:**
```json
{
  "totalSchemas":  12,
  "activeSchemas": 10,
  "totalFields":   87,
  "totalTables":   15
}
```

---

### 2. Danh Sách Schema

#### `GET /schemas`

**Query Parameters:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `search` | string | Tìm theo tên / mã schema |
| `type` | DocType | Lọc theo loại chứng từ |
| `isActive` | boolean | Lọc theo trạng thái (true/false) |

**Response `200`:**
```json
[
  {
    "id":          "uuid",
    "code":        "HOA_DON_GTGT",
    "name":        "Hóa đơn giá trị gia tăng",
    "type":        "INVOICE",
    "description": "Schema cho hóa đơn GTGT theo chuẩn Việt Nam",
    "isActive":    true,
    "fieldCount":  8,
    "tableCount":  1,
    "createdAt":   "2026-05-01T00:00:00.000Z"
  }
]
```

---

### 3. Chi Tiết Schema

#### `GET /schemas/:id`

#### `GET /schemas/code/:code`

Lấy schema theo mã code (ví dụ: `HOA_DON_GTGT`).

**Response `200`:**
```json
{
  "id":       "uuid",
  "code":     "HOA_DON_GTGT",
  "name":     "Hóa đơn giá trị gia tăng",
  "type":     "INVOICE",
  "isActive": true,
  "fields": [
    {
      "id":              "uuid",
      "key":             "sellerName",
      "label":           "Tên người bán",
      "dataType":        "TEXT",
      "position":        "HEADER",
      "isRequired":      true,
      "isUnique":        false,
      "validationRegex": null,
      "description":     "Tên đơn vị bán hàng",
      "displayOrder":    1
    }
  ],
  "tables": [
    {
      "id":          "uuid",
      "key":         "lineItems",
      "name":        "Danh sách hàng hóa",
      "description": null,
      "displayOrder": 1,
      "columns": [
        { "id": "uuid", "key": "name",      "label": "Tên hàng",   "dataType": "TEXT",     "isRequired": true,  "displayOrder": 1 },
        { "id": "uuid", "key": "unit",      "label": "ĐVT",        "dataType": "TEXT",     "isRequired": false, "displayOrder": 2 },
        { "id": "uuid", "key": "quantity",  "label": "Số lượng",   "dataType": "NUMBER",   "isRequired": false, "displayOrder": 3 },
        { "id": "uuid", "key": "unitPrice", "label": "Đơn giá",    "dataType": "CURRENCY", "isRequired": false, "displayOrder": 4 },
        { "id": "uuid", "key": "amount",    "label": "Thành tiền", "dataType": "CURRENCY", "isRequired": false, "displayOrder": 5 }
      ]
    }
  ]
}
```

---

### 4. Tạo Schema

#### `POST /schemas`

**Request Body:**
```json
{
  "code":        "PHIEU_KHO",
  "name":        "Phiếu xuất kho",
  "type":        "WAREHOUSE_RECEIPT",
  "description": "Schema cho phiếu xuất/nhập kho",
  "fields": [
    {
      "key":          "warehouseCode",
      "label":        "Mã kho",
      "dataType":     "TEXT",
      "position":     "HEADER",
      "isRequired":   true,
      "displayOrder": 1
    }
  ],
  "tables": [
    {
      "tableKey":    "items",
      "name":        "Danh sách hàng",
      "description": null,
      "columns": [
        { "columnKey": "code",     "label": "Mã hàng",    "dataType": "TEXT",   "isRequired": true,  "displayOrder": 1 },
        { "columnKey": "name",     "label": "Tên hàng",   "dataType": "TEXT",   "isRequired": true,  "displayOrder": 2 },
        { "columnKey": "quantity", "label": "Số lượng",   "dataType": "NUMBER", "isRequired": true,  "displayOrder": 3 }
      ]
    }
  ]
}
```

**Lưu ý:**
- `code` phải **duy nhất** trong hệ thống, chỉ dùng chữ hoa và dấu `_`
- `key` của mỗi field phải duy nhất trong schema
- `tableKey` và `columnKey` phải duy nhất trong schema / table tương ứng

**Response `201`:** Schema vừa tạo (format giống GET chi tiết)

---

### 5. Cập Nhật Schema

#### `PATCH /schemas/:id`

**Request Body:**
```json
{
  "name":        "Phiếu xuất kho (đã cập nhật)",
  "type":        "WAREHOUSE_RECEIPT",
  "description": "Mô tả mới",
  "isActive":    true
}
```

> Không thể đổi `code` sau khi tạo.

**Response `200`:** Schema đã cập nhật

---

### 6. Xóa Schema

#### `DELETE /schemas/:id`

> Không thể xóa schema đang được sử dụng bởi document nào.

**Response `200`:**
```json
{ "message": "Đã xóa schema thành công" }
```

---

### 7. Quản Lý Fields

#### `POST /schemas/:id/fields`

Thêm trường mới vào schema.

**Request Body:**
```json
{
  "fieldKey":        "taxCode",
  "label":           "Mã số thuế",
  "dataType":        "TEXT",
  "position":        "HEADER",
  "isRequired":      false,
  "isUnique":        false,
  "validationRegex": "^[0-9]{10}(-[0-9]{3})?$",
  "description":     "Mã số thuế người bán",
  "displayOrder":    5
}
```

**Response `201`:** Field vừa tạo

---

#### `PATCH /schemas/:id/fields/:fieldId`

**Request Body:** Các field cần cập nhật (partial)
```json
{
  "label":        "MST người bán",
  "isRequired":   true,
  "displayOrder": 3
}
```

**Response `200`:** Field đã cập nhật

---

#### `DELETE /schemas/:id/fields/:fieldId`

**Response `200`:**
```json
{ "message": "Đã xóa trường thành công" }
```

---

### 8. Quản Lý Tables

#### `POST /schemas/:id/tables`

**Request Body:**
```json
{
  "tableKey":    "vatLines",
  "name":        "Dòng thuế VAT",
  "description": null,
  "columns": [
    { "columnKey": "taxRate",  "label": "Thuế suất (%)", "dataType": "NUMBER",   "isRequired": true, "displayOrder": 1 },
    { "columnKey": "taxBase",  "label": "Tiền trước thuế", "dataType": "CURRENCY", "isRequired": true, "displayOrder": 2 },
    { "columnKey": "taxAmount","label": "Tiền thuế",     "dataType": "CURRENCY", "isRequired": true, "displayOrder": 3 }
  ]
}
```

**Response `201`:** Table vừa tạo

---

#### `PATCH /schemas/:id/tables/:tableId`

```json
{ "name": "Dòng VAT (cập nhật)", "displayOrder": 2 }
```

#### `DELETE /schemas/:id/tables/:tableId`

---

### 9. Quản Lý Columns

#### `POST /schemas/:id/tables/:tableId/columns`

```json
{
  "columnKey":    "note",
  "label":        "Ghi chú",
  "dataType":     "TEXT",
  "isRequired":   false,
  "description":  null,
  "displayOrder": 6
}
```

#### `PATCH /schemas/:id/tables/:tableId/columns/:columnId`

```json
{ "label": "Ghi chú dòng hàng", "displayOrder": 7 }
```

#### `DELETE /schemas/:id/tables/:tableId/columns/:columnId`

---

## III. Luồng Sử Dụng Điển Hình

### Upload và theo dõi OCR

```
1. POST /documents/upload   → nhận documentId[]
2. GET  /documents/:id/sse  → lắng nghe SSE
     event: progress        → cập nhật UI
     event: done            → fetch chi tiết
3. GET  /documents/:id      → hiển thị kết quả OCR
4. PATCH /documents/:id     → chỉnh sửa nếu cần
5. POST /documents/:id/confirm → xác nhận
```

### Tạo schema mới và upload

```
1. POST /schemas                    → tạo schema, nhận schemaId
2. POST /documents/upload
     body: { schemaId, files, ocrProvider: "gemini" }
3. GET /documents/:id/sse           → theo dõi tiến trình
```

---

## IV. Error Responses

Tất cả lỗi trả về format chuẩn:

```json
{
  "statusCode": 400,
  "message":    "Mô tả lỗi chi tiết",
  "error":      "Bad Request"
}
```

| HTTP Code | Ý nghĩa |
|-----------|---------|
| `400` | Dữ liệu đầu vào không hợp lệ |
| `404` | Không tìm thấy resource |
| `409` | Conflict (trùng code, sai status để thực hiện action) |
| `413` | File quá lớn (> 25 MB) |
| `415` | Định dạng file không hỗ trợ |
| `500` | Lỗi server nội bộ |

---

## V. Giới Hạn & Cấu Hình

| Thông số | Giá trị |
|----------|---------|
| File upload | Tối đa 20 file/request |
| Kích thước file | ≤ 25 MB/file |
| Định dạng hỗ trợ | PDF, PNG, JPEG, GIF, WebP, TIFF, DOCX, XLSX, XLS, CSV |
| SSE timeout | 10 phút |
| OCR concurrency | Mặc định 3 (env `OCR_CONCURRENCY`) |
| Job retry | 3 lần, backoff 2 giây |
