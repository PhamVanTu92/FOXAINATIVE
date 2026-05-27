# Index Service API — Hướng dẫn sử dụng

Tài liệu sử dụng **index-service** (Python/FastAPI) — chịu trách nhiệm
**ingest tài liệu → trích văn bản/OCR → chunk → embed → lưu vector store**
để chatbot dùng cho RAG.

> **Spec gốc (interactive):**
> - Swagger UI: <http://localhost:3001/api/index/docs>
> - ReDoc:      <http://localhost:3001/api/index/redoc>
> - OpenAPI JSON: <http://localhost:3001/api/index/openapi.json>

---

## 1. Base URL & xác thực

| Môi trường | Base URL |
|------------|----------|
| Local dev  | `http://localhost:3001/api/index` |
| Staging/Prod | `https://<domain>/api/index` |

Cùng JWT (HS256, secret share) như chatbot-service — xem chi tiết ở
[`docs/chatbot/README.md`](../chatbot/README.md#2-xác-thực-authentication).

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
```

Mọi endpoint bên dưới (trừ public) cần header `Authorization: Bearer $TOKEN`.

---

## 2. Mô hình dữ liệu

```
Collection (1) ──< Document (N) ──< Chunk (N)
    │                │                │
    │                │                └── embedding ──> Qdrant
    │                └── file (MinIO)
    └── tên dùng làm "kho RAG" cho chatbot
```

- **Collection** = "kho tri thức" — chatbot trỏ vào collection để truy vấn.
- **Document** = 1 file đã upload (PDF/Word/Excel/ảnh).
- **Chunk** = 1 đoạn văn bản đã cắt + embed, lưu kèm metadata.

---

## 3. Quy trình end-to-end (Step-by-step)

### Bước 1 — Tạo collection

```http
POST /v1/collections/collections
Authorization: Bearer <token>
Content-Type: application/json

{
  "collection_name": "kb_sanpham",
  "description": "Catalog sản phẩm và bảng giá Q4-2026",
  "collection_style": "precise",
  "creativity_level": "low",
  "provider_embedding": "gemini",
  "provider_storage": "qdrant"
}
```

| Field | Bắt buộc | Default | Ghi chú |
|-------|---------|---------|---------|
| `collection_name` | ✓ | — | Tên duy nhất, dùng làm key truy vấn |
| `description` |   | `""` | Hiển thị cho LLM khi router collection |
| `collection_style` |   | `null` | `precise` / `balanced` / `creative` |
| `creativity_level` |   | `null` | `low` / `medium` / `high` |
| `provider_embedding` |   | `gemini` | `gemini` \| `openai` |
| `provider_storage` |   | `qdrant` | `qdrant` |

### Bước 2 — Liệt kê collection

```http
GET /v1/collections/collections?page=1&page_size=10&search=kb_
```

Response:
```json
{
  "message": "Process successfully !!!",
  "info": {
    "data": {
      "collections": [
        {"id":"...", "collection_name":"kb_sanpham", "documents_count": 12, ...}
      ],
      "total": 1, "page": 1, "page_size": 10, "total_pages": 1
    }
  }
}
```

### Bước 3 — Upload tài liệu (2-step)

Đây là quy trình **2 step bắt buộc** — upload trước, sau đó mới trigger
processing. Lý do: upload có thể tải nhiều file đồng thời, processing tốn LLM
tokens nên user xác nhận lại loại xử lý trước khi chạy.

**Step 3a — Batch upload (chỉ ghi file vào MinIO + tạo record DB):**

```bash
curl -X POST "http://localhost:3001/api/index/v1/collections/${COLLECTION_ID}/documents/batch-upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./catalog.pdf" \
  -F "files=@./bang-gia.xlsx" \
  -F "files=@./brochure.docx"
```

Response trả về `document_ids` (list) cùng `status: PENDING`.
Tối đa **10 file / request**.

**Step 3b — Trigger processing (extract text → chunk → embed):**

```http
POST /v1/collections/{collection_id}/documents/batch-process
Authorization: Bearer <token>
Content-Type: application/json

{
  "document_ids": ["doc-uuid-1", "doc-uuid-2", "doc-uuid-3"],
  "processing_type": "document_structured",
  "effective_from": "2026-01-01",
  "effective_to": "2026-12-31",
  "issuing_unit": "Phòng kinh doanh",
  "access_scope": "internal",
  "version": "v1.0"
}
```

| Field | Bắt buộc | Ghi chú |
|-------|---------|---------|
| `document_ids` | ✓ | Phải thuộc về collection trên path |
| `processing_type` | ✓ | `excel` (cho .xlsx) hoặc `document_structured` (cho PDF/Word/ảnh) |
| `effective_from` / `effective_to` |   | ISO date — gán metadata cho mọi chunk |
| `issuing_unit` |   | Đơn vị phát hành (filter sau này) |
| `access_scope` |   | `internal` / `public` |
| `version` |   | Đính kèm chunk metadata |

Processing chạy async → poll trạng thái qua `GET /v1/collections/{id}/documents`.

### Bước 4 — Theo dõi tiến độ document

```http
GET /v1/collections/{collection_id}/documents
  ?page=1&page_size=20
  &processing_status=COMPLETED|PROCESSING|FAILED|PENDING
  &processing_type=excel|document_structured
  &search=catalog
```

Trả về list `{document_id, filename, processing_status, total_chunks, error_message}`.

### Bước 5 — Truy vấn chunk

```http
GET /v1/documents/{document_id}                                # chi tiết document
GET /v1/documents/{document_id}/chunks
  ?page=1&page_size=50&include_disabled=false&search=bảo hành
```

---

## 4. Quản lý chunk thủ công

Đôi khi RAG cắt sai → cần can thiệp tay.

### 4.1. Thêm chunk

```http
POST /v1/documents/{document_id}/chunks
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Sản phẩm A có bảo hành 24 tháng kể từ ngày kích hoạt.",
  "chunk_index": 12,
  "metadata": { "section": "Bảo hành", "page": 5 },
  "is_enabled": true
}
```

Server tự embed nội dung & upsert vào vector store.

### 4.2. Sửa chunk

```http
PUT /v1/chunks/{chunk_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "...nội dung mới...",
  "metadata": { "section": "Bảo hành mới" },
  "is_enabled": true
}
```

Tất cả 3 field đều optional, chỉ field nào gửi mới được cập nhật.
Nếu `content` thay đổi → re-embed tự động.

### 4.3. Bật/tắt chunk (không xóa, chỉ ẩn khỏi RAG)

```http
PATCH /v1/chunks/{chunk_id}/toggle
Authorization: Bearer <token>
Content-Type: application/json

{ "is_enabled": false }
```

### 4.4. Xóa chunk

```http
DELETE /v1/chunks/{chunk_id}
```

---

## 5. Xóa document / collection

```http
DELETE /v1/documents/{document_id}              # xóa cascade chunk + vector
DELETE /v1/collections/collections/{collection_id}   # xóa cascade document + chunk + vector
```

> ⚠️ Không có soft-delete — xóa là **hard delete**. Nên export trước nếu cần.

---

## 6. Endpoint internal (service-to-service)

Không nên gọi từ browser — dùng cho chatbot-service hỏi metadata khi route câu hỏi.

```http
GET /v1/internal/collections/{collection_name}/description
GET /v1/internal/collections/{collection_name}/document-names
```

Vẫn cần JWT (service-token) — chatbot-service tự forward token user.

---

## 7. Public resources (file / image)

Khi LLM trả về ảnh hoặc file đính kèm, link sẽ có dạng:

```
http://localhost:3001/api/index/v1/public/images/{bucket}/{path}
http://localhost:3001/api/index/v1/public/files/{bucket}/{path}
```

Endpoint này **bypass JWT** vì widget nhúng `<img src>` / `<a href>` không gửi
được header `Authorization`. Bảo mật dựa trên độ khó đoán của `bucket` + `path`
(capability URL pattern).

---

## 8. Bảng error code

| HTTP | Khi nào xảy ra | Xử lý phía client |
|------|----------------|-------------------|
| 401  | Token hết hạn / sai | Login lại |
| 403  | Token đúng nhưng thiếu role (ADMIN/SUPER_ADMIN/MANAGER) | Đổi user |
| 404  | `collection_id`/`document_id`/`chunk_id` không tồn tại hoặc không thuộc user | Kiểm tra ID |
| 409  | Trùng `collection_name` | Đổi tên |
| 413  | File quá to (default 100 MB/file) | Tách file nhỏ |
| 422  | Validation fail — đọc `detail[].loc` | Sửa body |
| 500  | Lỗi extract/embed/vector store | Xem log `foxai-index-py-service` |

---

## 9. Ví dụ end-to-end (bash)

```bash
#!/usr/bin/env bash
set -e
BASE=http://localhost:3001
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

H="Authorization: Bearer $TOKEN"

# 1. Tạo collection
COLL=$(curl -s -X POST $BASE/api/index/v1/collections/collections \
  -H "$H" -H 'Content-Type: application/json' \
  -d '{"collection_name":"kb_demo","description":"Demo"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["info"]["data"]["id"])')
echo "Collection: $COLL"

# 2. Upload PDF
DOCS=$(curl -s -X POST "$BASE/api/index/v1/collections/$COLL/documents/batch-upload" \
  -H "$H" -F "files=@./sample.pdf" \
  | python3 -c 'import sys,json;print(",".join(d["id"] for d in json.load(sys.stdin)["info"]["data"]["documents"]))')
echo "Documents: $DOCS"

# 3. Trigger process
IDS_JSON=$(python3 -c "print('[\"' + '\",\"'.join('$DOCS'.split(',')) + '\"]')")
curl -s -X POST "$BASE/api/index/v1/collections/$COLL/documents/batch-process" \
  -H "$H" -H 'Content-Type: application/json' \
  -d "{\"document_ids\":$IDS_JSON,\"processing_type\":\"document_structured\"}"

# 4. Đợi & poll status (loop 5s)
while true; do
  STATUS=$(curl -s "$BASE/api/index/v1/collections/$COLL/documents" -H "$H" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin)["info"]["data"]["documents"];print(",".join(x["processing_status"] for x in d))')
  echo "Status: $STATUS"
  [[ "$STATUS" != *PROCESSING* && "$STATUS" != *PENDING* ]] && break
  sleep 5
done

# 5. Liệt kê chunk
DOC1=${DOCS%%,*}
curl -s "$BASE/api/index/v1/documents/$DOC1/chunks?page=1&page_size=5" -H "$H" | python3 -m json.tool
```

---

## 10. Tài liệu liên quan

- [Chatbot Service API](../chatbot/README.md) — sử dụng collection cho RAG khi chat.
- [`docker-compose.yml`](../../docker-compose.yml) — cấu hình runtime (Qdrant, MinIO, Postgres).
