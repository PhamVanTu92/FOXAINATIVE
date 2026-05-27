# Chatbot Service API — Hướng dẫn sử dụng

Tài liệu hướng dẫn dùng **chatbot-service** (Python/FastAPI) qua **api-gateway** (NestJS).
Phục vụ cho việc tích hợp web-portal, widget nhúng bên thứ ba, và backend service-to-service.

> **Spec gốc (interactive):**
> - Swagger UI: <http://localhost:3001/api/chatbot/docs>
> - ReDoc:      <http://localhost:3001/api/chatbot/redoc>
> - OpenAPI JSON: <http://localhost:3001/api/chatbot/openapi.json>

---

## 1. Kiến trúc & Base URL

```
Browser / Client
        │
        ▼
┌──────────────────────┐         ┌──────────────────────────┐
│ api-gateway :3001    │  proxy  │ chatbot-service :8000    │
│ /api/chatbot/*       │ ───────▶│ (FastAPI, internal only) │
└──────────────────────┘         └──────────────────────────┘
```

| Môi trường | Base URL |
|------------|----------|
| Local dev  | `http://localhost:3001/api/chatbot` |
| Staging/Prod | `https://<domain>/api/chatbot` |

Tất cả endpoint trong tài liệu này là **path tương đối** so với base URL.
Ví dụ: `/v1/chatbots` ⇒ `http://localhost:3001/api/chatbot/v1/chatbots`.

---

## 2. Xác thực (Authentication)

Có **hai cơ chế xác thực** song song:

### 2.1. Bearer JWT (cho user thật trên web-portal)

JWT do **system-service** (.NET) cấp khi login. Thuật toán **HS256**, ký bằng
`JWT_SECRET` dùng chung giữa system-service + chatbot + index.

#### Login để lấy token

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345"}'
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "...",
  "expiresIn": "604800",
  "user": {
    "id": "9e54...",
    "username": "admin",
    "roles": ["SUPER_ADMIN"],
    "permissions": ["..."]
  }
}
```

Dùng token cho các call tiếp theo:

```bash
TOKEN=eyJhbGciOi...

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/chatbot/v1/chatbots
```

**Role mapping:**
- `SUPER_ADMIN` / `ADMIN` ⇒ pass mọi endpoint admin.
- `MANAGER` ⇒ pass endpoint manager (create/update chatbot, list conversations…).
- Các role khác chỉ vào được endpoint không cần role gating (vd: lấy chatbot đã apply, send chat).

### 2.2. Public ID (cho widget nhúng bên thứ ba)

Widget chạy trên domain khách không có JWT — thay vào đó dùng `public_id` (token xoay
được trên mỗi chatbot). Endpoint `Public()` trên gateway sẽ bypass JWT guard, server
tự kiểm `public_id` có hợp lệ + chatbot còn `is_active`.

Endpoint public bao gồm:
- `GET  /widget/*`, `GET /dist/sdk.js`
- `GET  /v1/public/chatbots/{public_id}`
- `POST /v1/agents/public/chat/public`, `POST /v1/agents/public/chat/public/stream`
- `POST /v1/tts/synthesize` (quota-gated theo `public_id`)

---

## 3. Chatbot CRUD

### 3.1. Tạo chatbot

```http
POST /v1/chatbots
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Trợ lý Bán hàng",
  "purpose": "customer_care",
  "form": "chat",
  "description": "Trả lời FAQ và tư vấn sản phẩm",
  "system_prompt": "Bạn là trợ lý lịch sự, trả lời ngắn gọn bằng tiếng Việt.",
  "faqs": [
    {"question": "Giờ mở cửa?", "answer": "8h–22h hằng ngày."}
  ],
  "collections": ["kb_sanpham", "kb_chinhsach"],
  "welcome_message": "Xin chào! Tôi giúp gì được ạ?",
  "widget_theme": {"primary": "#0066ff", "position": "bottom-right"},
  "is_active": true
}
```

| Field | Bắt buộc | Default | Ghi chú |
|-------|---------|---------|---------|
| `name` | ✓ | — | Tên hiển thị |
| `purpose` |   | `customer_care` | `customer_care` / `sales` / `support`… |
| `form` |   | `chat` | `chat` hoặc `voice` |
| `system_prompt` |   | `null` | Persona / nội quy của bot |
| `faqs` |   | `null` | Danh sách `{question, answer}` |
| `collections` |   | `[]` | Tên collection bên index-service dùng cho RAG |
| `widget_theme` |   | `null` | Object màu/vị trí widget |
| `is_active` |   | `true` | False ⇒ chặn cả web + widget |

Response trả về object chatbot kèm `id`, `public_id` (UUID), `created_at`.

### 3.2. Danh sách / chi tiết / cập nhật / xóa

```http
GET    /v1/chatbots
GET    /v1/chatbots/{chatbot_id}
PUT    /v1/chatbots/{chatbot_id}     (body như Create)
DELETE /v1/chatbots/{chatbot_id}
```

### 3.3. Apply (gán chatbot làm bot mặc định cho user hiện tại)

```http
POST /v1/chatbots/{chatbot_id}/apply
GET  /v1/chatbots/applied            # lấy chatbot đang được apply
```

### 3.4. Embed snippet & xoay public_id

```http
GET  /v1/chatbots/{chatbot_id}/embed-snippet
POST /v1/chatbots/{chatbot_id}/rotate-public-id
```

`embed-snippet` trả về đoạn HTML `<script>` để paste vào website khách:

```html
<script src="https://<domain>/api/chatbot/dist/sdk.js"
        data-public-id="abc123-..."
        async></script>
```

Khi rò rỉ `public_id` ⇒ gọi `rotate-public-id` để cấp UUID mới, widget cũ tự
ngừng hoạt động.

---

## 4. Chat với agent (RAG + streaming)

### 4.1. Authenticated chat — SSE stream

```http
POST /v1/agents/chat/stream
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Tóm tắt chính sách bảo hành cho tôi.",
  "conversation_id": null,
  "file_ids": ["b9f4..."],
  "chatbot_id": "1c2e..."
}
```

| Field | Bắt buộc | Default | Ghi chú |
|-------|---------|---------|---------|
| `message` | ✓ | — | Tin nhắn người dùng |
| `conversation_id` |   | `null` | Bỏ trống ⇒ tạo conversation mới |
| `file_ids` |   | `null` | ID file đã upload qua `/v1/files/upload` |
| `chatbot_id` |   | `null` | Có ⇒ server tự dùng `collections` của chatbot |
| `provider_llm` |   | `gemini` | `gemini` \| `openai` |
| `collection_name` |   | `foxai_native_default` | Override khi không truyền `chatbot_id` |

**Response: `text/event-stream`** — đọc bằng `EventSource` / `fetch + ReadableStream`.

```js
const res = await fetch('/api/chatbot/v1/agents/chat/stream', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Xin chào' })
});
const reader = res.body.getReader();
const dec = new TextDecoder();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  // Each SSE event: "data: {json}\n\n"
  console.log(dec.decode(value));
}
```

### 4.2. Public chat (cho widget nhúng — không cần JWT)

```http
POST /v1/agents/public/chat/public/stream
Content-Type: application/json

{
  "message": "Giờ mở cửa?",
  "client_id": "anon-uuid-trinh-duyet-tự-tạo",
  "public_id": "<public_id của chatbot>",
  "conversation_id": null,
  "session_info": { "user_agent": "...", "platform": "web" }
}
```

| Field | Bắt buộc | Ghi chú |
|-------|---------|---------|
| `message` | ✓ | |
| `client_id` | ✓ | UUID do widget tự sinh & lưu localStorage, để track conversation cross-session |
| `public_id` |   | Optional nhưng KHUYẾN NGHỊ — server check chatbot active & quota |

Variant **non-streaming** (JSON một cục): `POST /v1/agents/public/chat/public`.

---

## 5. Conversations (lịch sử chat)

```http
GET    /v1/conversations?page=1&page_size=20&search=bảo hành
GET    /v1/conversations/export                        # tải file Excel
GET    /v1/conversations/{conversation_id}/messages
PUT    /v1/conversations/{conversation_id}             { "title": "..." }
DELETE /v1/conversations/{conversation_id}
```

### Share conversation (link công khai)

```http
POST   /v1/conversations/{conversation_id}/shares      # tạo link
GET    /v1/conversations/{conversation_id}/shares      # liệt kê link
GET    /v1/shared/{share_token}                        # PUBLIC — xem trang share
DELETE /v1/shares/{share_id}                           # thu hồi
```

---

## 6. File upload (đính kèm vào chat)

```bash
curl -X POST http://localhost:3001/api/chatbot/v1/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./hop-dong.pdf" \
  -F "files=@./bao-gia.xlsx"
```

Response trả về danh sách `{file_id, filename, mime_type, size}`.
Sau đó truyền `file_ids` vào `/v1/agents/chat/stream`.

---

## 7. Text-to-Speech

```http
POST /v1/tts/synthesize
Content-Type: application/json

{
  "text": "Xin chào, tôi có thể giúp gì cho bạn?",
  "voice_name": "Kore",
  "public_id": "<optional, để quota-gate>"
}
```

Voice hỗ trợ (Gemini TTS): `Zephyr`, `Puck`, `Charon`, `Kore`, `Fenrir`, `Leda`.

Response: `audio/wav` (raw binary, ghi thẳng vào `<audio>` hoặc lưu file).

---

## 8. Dashboard (admin/manager)

```http
GET /v1/dashboard/overview          # KPI tổng quan
GET /v1/dashboard/users             # usage theo user
```

Cần role `ADMIN`/`SUPER_ADMIN`/`MANAGER`.

---

## 9. Webhook kênh ngoài

| Kênh | Verify | Receive |
|------|--------|---------|
| Facebook  | `GET  /v1/agents/facebook/webhook`  | `POST /v1/agents/facebook/webhook`  |
| WhatsApp  | `GET  /v1/agents/whatsapp/webhook`  | `POST /v1/agents/whatsapp/webhook`  |
| FB tạm    | `GET  /v1/agents/facebook-tmp/webhook` | `POST /v1/agents/facebook-tmp/webhook` |

Cấu hình webhook URL ở Facebook/WhatsApp Business Manager, verify token đặt
trong env của chatbot-service.

---

## 10. Bảng error code

| HTTP | Khi nào xảy ra | Xử lý phía client |
|------|----------------|-------------------|
| 401  | Token hết hạn / sai chữ ký | Login lại, làm mới token |
| 403  | Token đúng nhưng thiếu role | Đổi tài khoản có role phù hợp |
| 404  | `chatbot_id`/`conversation_id` không tồn tại hoặc không thuộc user | Kiểm tra ID |
| 422  | Body validation fail | Đọc `detail[].loc` để biết field nào sai |
| 429  | Vượt rate-limit public chat | Backoff, hoặc nâng quota chatbot |
| 500  | Lỗi LLM/embedding/vector store | Xem log container `foxai-chatbot-service` |

---

## 11. Tham khảo nhanh — Postman / HTTPie

### HTTPie

```bash
http POST :3001/api/auth/login username=admin password=Admin@12345
TOKEN=$(...)
http :3001/api/chatbot/v1/chatbots "Authorization: Bearer $TOKEN"
http POST :3001/api/chatbot/v1/chatbots "Authorization: Bearer $TOKEN" \
  name="Demo bot" purpose=customer_care
```

### Postman collection

Import OpenAPI JSON: `File → Import → URL → http://localhost:3001/api/chatbot/openapi.json`.
Postman tự sinh đầy đủ folder + ví dụ body.

---

## 12. Tài liệu liên quan

- [Index Service API](../index/README.md) — quản lý collection, document, chunk cho RAG.
- [`CHATBOT_PYTHON_PORT.md`](../CHATBOT_PYTHON_PORT.md) — quyết định kiến trúc port Python service vào monorepo.
- [`docker-compose.yml`](../../docker-compose.yml) — cấu hình runtime.
