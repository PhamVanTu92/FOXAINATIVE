# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ: HỎI ĐÁP CHATBOT (RAG + GIỌNG NÓI)

> **Mã tài liệu:** BA-CHAT-01
> **Phiên bản:** 1.2
> **Phân hệ:** Hỏi đáp Chatbot AI (RAG + Voice Streaming)
> **Service:** `chatbot-service` (Python · FastAPI · LangGraph)
> **Port:** HTTP 8000 — public qua API Gateway tại prefix `/api/chatbot`
> **Tham chiếu:** [[Quan_ly_Tri_Thuc]] (BA-KB-01) · [[Tech_Stack_Architecture]]

---

## 1. Tổng quan phân hệ

### 1.1. Mục đích

Phân hệ **Hỏi đáp Chatbot** cho phép vận hành viên tạo các chatbot trả lời câu hỏi
**dựa trên tài liệu nội bộ** của tổ chức theo cơ chế **RAG (Retrieval Augmented
Generation)**. Mục tiêu cốt lõi:

1. **Trả lời có căn cứ:** câu trả lời được sinh **chỉ từ nội dung tài liệu** đã nạp,
   kèm **trích dẫn nguồn** (tên tài liệu, số trang, hiệu lực) — hạn chế tối đa bịa đặt.
2. **Đa kênh, đa bộ tri thức:** một chatbot gắn 1..N *bộ tri thức*, phục vụ qua web
   portal, widget nhúng, REST API và **giọng nói (TTS)**.

> **Liên kết hệ thống:** Tài liệu được nạp/cắt chunk/embedding bởi `index-service`
> và lưu vector trong **Qdrant**; `chatbot-service` truy hồi từ chính các vector đó.

### 1.2. Vai trò

| Khía cạnh | Mô tả |
|---|---|
| **Tạo chatbot** | Cấu hình bot: tên, mục đích, prompt hệ thống, FAQ, chế độ trả lời (text/voice) |
| **Gắn tri thức** | Liên kết bot với 1..N bộ tri thức (collection Qdrant) để truy hồi |
| **Hỏi đáp RAG** | Truy hồi đoạn tài liệu liên quan → sinh câu trả lời có trích dẫn |
| **Đa kênh** | Web portal, widget nhúng (SDK), iframe, REST API, giọng nói |
| **Ghi nhớ** | Bộ nhớ hội thoại (ngắn hạn) + bộ nhớ cá nhân hóa Mem0 (dài hạn) |

### 1.3. Đối tượng sử dụng

| Vai trò | Quyền hạn | Tần suất |
|---|---|---|
| **Admin / Vận hành** | Tạo/sửa/xóa chatbot, gắn bộ tri thức, cấu hình giọng nói | Trung bình |
| **Người dùng cuối** | Hỏi đáp với chatbot (portal hoặc widget nhúng) | Rất cao |
| **Khách ẩn danh** | Hỏi đáp qua widget công khai (`public_id`), không cần đăng nhập | Cao |
| **AI Engine** | LLM/Embedding/TTS provider (Gemini/OpenAI/Claude/FoxAI LLM) | Tự động |

---

## 2. Kiến trúc & Luồng xử lý

### 2.1. Sơ đồ tổng thể

```
┌──────────────────────────────────────────────────────────────────────┐
│   WEB PORTAL (Next.js)      │   WIDGET SDK nhúng (dist/sdk.js)         │
└───────────────┬─────────────┴───────────────┬──────────────────────────┘
                │  /api/chatbot/v1/agents/chat/stream   (SSE, có token)
                │  /api/chatbot/v1/agents/public/...     (SSE, public_id)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY (NestJS :3001)                      │
│   reverse-proxy  /api/chatbot/*  ──►  http://chatbot-service:8000     │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   CHATBOT SERVICE (FastAPI :8000)                     │
│                                                                      │
│  StreamAgentService  ──►  AgenticGraph (LangGraph)                   │
│                              │                                       │
│            ┌─────────────────┴───────────────────┐                  │
│            ▼                                     ▼                  │
│      agentic_agent  ──handoff──►  rag_agent / comparison_agent      │
│            │                          │                             │
│            │                          ▼                             │
│            │                  RetrieverService (hybrid)             │
│            │                  cosine + MMR + full-text + BM25 → RRF  │
│            ▼                          │                             │
│      Redis checkpointer        Qdrant (vector store)                │
│      Mem0 (long-term)          Gemini embedding (query)             │
│                                                                      │
│  TTS: /v1/tts/synthesize (one-shot)  +  inline audio_chunk (stream)  │
└───────────────────────────────┬──────────────────────────────────────┘
        Postgres (chatbot_db)    │    Qdrant (:6333)   Redis   MinIO
        chatbots, conversations, │    collection mỗi bộ tri thức
        messages, chatbot_collections
```

### 2.2. Luồng hỏi đáp một lượt (RAG)

```
[User] gửi câu hỏi  ──► POST /v1/agents/chat/stream  (SSE)
   │
   ├─► 1. Resolve chatbot (nếu có chatbot_id): nạp prompt, FAQ, danh sách bộ tri thức
   ├─► 2. Khôi phục ngữ cảnh hội thoại (Redis checkpointer; fallback PostgreSQL)
   ├─► 3. Nạp bộ nhớ Mem0 theo (user × chatbot)
   ├─► 4. agentic_agent định tuyến → rag_agent
   │        │
   │        └─► retriever_tool: nhúng câu hỏi (Gemini) → truy hồi hybrid trên Qdrant
   │                 → trả về top-k đoạn + metadata (tài liệu, trang, hiệu lực)
   ├─► 5. rag_agent tổng hợp câu trả lời (grounding theo lượt) + chèn trích dẫn
   ├─► 6. Stream text theo token (event message_chunk)
   │        └─ (tùy chọn) sinh giọng nói theo câu → event audio_chunk
   └─► 7. Lưu message (human + ai) vào PostgreSQL, sinh tiêu đề hội thoại
```

### 2.3. Multi-agent (LangGraph)

| Node | Vai trò |
|---|---|
| **agentic_agent** | Bộ định tuyến trung tâm; chuyển (handoff) sang agent chuyên trách |
| **rag_agent** | Hỏi đáp tri thức: tự chọn tham số truy hồi, gọi `retriever_tool`, tổng hợp |
| **comparison_agent** | So sánh tài liệu (yêu cầu "so sánh", "khác nhau", "versus") |

> **Bộ nhớ 2 tầng:** *Redis checkpointer* giữ ngữ cảnh hội thoại theo `conversation_id`;
> *Mem0* giữ trí nhớ dài hạn theo `(user_id × chatbot_id)` — **không rò rỉ chéo** giữa các bot.

---

## 3. Cơ chế Chunk & Truy hồi (RAG Engine)

### 3.1. Cắt chunk (do `index-service` thực hiện)

Tài liệu (PDF/DOCX/TXT/ảnh/Excel) → bóc text → **Hierarchical Markdown Chunker**:

| Đặc điểm | Mô tả |
|---|---|
| **Bám cấu trúc** | Nhận diện tiêu đề `#`, dựng *breadcrumb* `section_heading` (vd `Luật LĐ - Chương II - Điều 6`) |
| **Theo trang** | Với **PDF** (vision parser chèn mốc `<!-- PAGE: n -->`) → chunk lưu đúng `page_number` |
| **Cắt theo câu** | `chunk_size ≈ 700` ký tự, có **overlap** ~100 ký tự, không cắt giữa câu |
| **Nhận biết bảng** | Bảng < 3500 ký tự giữ nguyên; bảng lớn tách và lặp header |
| **Metadata/chunk** | `document_name`, `page_number`, `section_heading`, `chunk_index`, `effective_from/to`, `file_url` |
| **Embedding** | `models/gemini-embedding-001` (3072 chiều) → lưu Qdrant (1 collection / bộ tri thức) |

> ⚠️ **Lưu ý:** `page_number` chỉ chính xác với tài liệu **PDF**. DOCX/TXT không có mốc
> trang nên mọi chunk mặc định `Page: 1` (cân nhắc trích dẫn theo "Điều/Mục").

### 3.2. Truy hồi lai (Hybrid Retrieval + RRF)

Một câu hỏi chạy **nhiều hướng tìm song song**, rồi hợp nhất:

```
                       câu hỏi
   ┌────────────┬─────────────┬───────────────┬──────────────┐
 Cosine        MMR        Full-text       Section-name
(ngữ nghĩa)  (đa dạng)   (khớp chữ/số)   (theo mục heading)
   └──BM25 rerank──┘          │                 │
              └────────►  RRF (Reciprocal Rank Fusion)  ◄──┘
                              │
                  (tùy chọn) mở rộng cả mục (section expansion)
                              │
                       top-k chunk + trích dẫn nguồn
```

| Thành phần | Vai trò |
|---|---|
| **Cosine** | Tìm theo ý nghĩa (vector) — bắt câu hỏi diễn đạt khác từ trong tài liệu |
| **MMR** | Chọn đoạn vừa liên quan vừa đa dạng, tránh trả về các đoạn na ná nhau |
| **Full-text** | Khớp đúng chữ/số/mã (vd "Điều 6", "45/2019/QH14") |
| **BM25 rerank** | Xếp lại theo tần suất từ khóa |
| **RRF** | Hợp nhất nhiều bảng xếp hạng (`score = 1/(k+rank)`, `k=60`) — đoạn nào được nhiều phương pháp đồng thuận thì lên top |

**3 chế độ truy hồi** (rag_agent tự chọn theo loại câu hỏi):

| Chế độ | Khi dùng | Đặc điểm |
|---|---|---|
| `balanced` | Câu hỏi thường (mặc định) | Cân bằng cosine/MMR/BM25, ngưỡng 0.6 |
| `section_focused` | "Toàn bộ Điều X", "mục..." | Gom cả mục, mở rộng section |
| `diversity` | "So sánh", "liệt kê tất cả" | Tăng đa dạng, lấy nhiều đoạn |

> **Đa bộ tri thức:** truy vấn được **tỏa ra tất cả collection** mà bot gắn rồi gộp kết quả
> (fan-out); có thể lọc theo `document_name`.

### 3.3. Trích dẫn nguồn & Grounding

- Mỗi đoạn truy hồi mang metadata → câu trả lời đính kèm dòng:
  `**Source:** <tài liệu>, Page: <trang> | **Effective:** <từ> - <đến>`.
- **Grounding theo lượt:** chỉ trả lời dựa trên ngữ cảnh **vừa truy hồi cho câu hỏi hiện
  tại**; **không tái sử dụng** đáp án/citation của lượt trước. Nếu ngữ cảnh không chứa
  thông tin (kể cả đúng trang/điều được hỏi) → trả lời **"không tìm thấy trong cơ sở tri thức"**.

---

## 4. Luồng Streaming (SSE) & Giọng nói

### 4.1. Server-Sent Events (SSE)

Endpoint chat trả về **luồng SSE** (`Content-Type: text/event-stream`); mỗi event là một
dòng `data: {json}`. Các loại event:

| `type` | Ý nghĩa |
|---|---|
| `conversation_started` | Trả `conversation_id` ngay đầu luồng để client lưu |
| `message_chunk` | Một mẩu text của câu trả lời (ghép dần → hiệu ứng "đang gõ") |
| `audio_chunk` | (tùy chọn) Một câu đã được tổng hợp giọng nói — xem §4.3 |
| `keep_alive` | Giữ kết nối khi xử lý lâu (mỗi ~30s) |
| `message_complete` | Kết thúc; kèm `artifact` (danh sách nguồn/sources) |
| `error` | Lỗi xử lý |

### 4.2. Giọng nói một-phát (One-shot TTS)

`POST /v1/tts/synthesize` — chuyển một đoạn text → **WAV** (Gemini TTS, 24kHz/16-bit/mono).
Dùng khi client muốn đọc lại **toàn bộ** câu trả lời sau khi text đã xong.

| Trường | Giá trị |
|---|---|
| Provider | Gemini `gemini-2.5-flash-preview-tts` (one-shot) |
| Output | `audio/wav` (header WAV + PCM) |
| Điều kiện | Chatbot ở chế độ `voice` hoặc `both` |

> **Hạn chế:** tuần tự (đợi text xong → mới sinh audio cả đoạn) → trễ với câu trả lời dài.

### 4.3. Giọng nói streaming inline (audio_chunk) — *Approach C*

Tối ưu độ trễ: backend **vừa stream text vừa tổng hợp giọng nói theo từng câu** và đẩy
audio vào **chính luồng SSE** (cùng kênh với text). Người dùng bắt đầu nghe ngay sau
**câu đầu tiên** thay vì sau toàn bộ text + toàn bộ TTS.

**Bật tính năng (opt-in):** thêm `"inline_audio": true` vào body của
`/v1/agents/chat/stream`. Mặc định `false` → hành vi không đổi, không tốn quota TTS.

**Điều kiện kích hoạt:** `inline_audio = true` **VÀ** chatbot ở chế độ `voice`/`both`
(nếu không gắn chatbot thì chỉ cần `inline_audio = true`).

**Hợp đồng event `audio_chunk`:**
```json
{
  "type": "audio_chunk",
  "seq": 0,                       // thứ tự — client phát theo đúng seq
  "audio_format": "wav",
  "audio": "<base64 WAV 24kHz/16-bit/mono của 1 câu>",
  "conversation_id": "..."
}
```

**Yêu cầu phía client (FE):** giải mã base64 → `decodeAudioData` (Web Audio API) → **xếp
hàng phát nối tiếp liền mạch theo `seq`**; nút dừng hủy cả hàng đợi audio lẫn stream. Các
event cũ (`message_chunk`, `message_complete`...) giữ nguyên.

**Cơ chế backend:** gom token → phát hiện ranh giới câu (`.!?…;` + xuống dòng, tránh vỡ số
thập phân) → tổng hợp TTS **nền (background task)** → emit `audio_chunk` **đúng thứ tự**.
Toàn bộ best-effort: lỗi TTS **không** làm gián đoạn luồng text.

### 4.4. Chọn giọng đọc (Voice picker)

Người dùng có thể **chọn giọng** trước khi nghe; backend đọc văn bản bằng giọng đó.

1. **Lấy danh sách giọng:** `GET /v1/tts/voices` → `[{ id, name, gender, language }]`.
   (Hiện là các giọng Gemini đa ngôn ngữ: Zephyr, Puck, Charon, Kore, Fenrir, Leda,
   Orus, Aoede — đọc tiếng Việt được.)
2. **Gửi giọng đã chọn:** `POST /v1/tts/synthesize` với field **`voice_id`** (vd `"Kore"`).
   Thứ tự ưu tiên giọng: `voice_id` (theo yêu cầu) > `widget_theme.voiceName` (cấu hình
   bot) > giọng mặc định server. Giọng không hợp lệ → tự rơi về mặc định.

> **Lưu ý gateway:** `GET /v1/tts/voices` hiện **yêu cầu token** ở api-gateway (portal có
> token nên chạy). Widget công khai muốn dùng dropdown thì cần whitelist `/v1/tts/voices`
> là public ở **api-gateway** (ngoài phạm vi chatbot-service).

---

## 5. Đặc tả API (REST/SSE — qua Gateway prefix `/api/chatbot`)

### 5.1. Hỏi đáp & giọng nói

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/v1/agents/chat/stream` | Hỏi đáp có xác thực (SSE) |
| `POST` | `/v1/agents/public/chat/public/stream` | Hỏi đáp công khai cho widget (SSE, `public_id`) |
| `GET`  | `/v1/tts/voices` | Danh sách giọng để người dùng chọn — `[{id, name, gender, language}]` |
| `POST` | `/v1/tts/synthesize` | Text → WAV (one-shot TTS); chọn giọng qua `voice_id` |

**Body `POST /v1/agents/chat/stream`:**

| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `message` | string | ✓ | Câu hỏi của người dùng |
| `conversation_id` | uuid | | Tiếp tục hội thoại cũ; bỏ trống → tạo mới |
| `chatbot_id` | uuid | | Khi có → server áp prompt/FAQ/bộ tri thức của bot |
| `collection_name` | string | | Hỏi trực tiếp theo 1 bộ tri thức (khi không dùng chatbot) |
| `file_ids` | uuid[] | | Đính kèm tệp làm ngữ cảnh |
| `inline_audio` | bool | | `true` để bật giọng nói streaming (audio_chunk) — mặc định `false` |

### 5.2. Quản lý chatbot & hội thoại

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/v1/chatbots` | Danh sách chatbot của người dùng |
| `POST` | `/v1/chatbots` | Tạo chatbot |
| `GET/PUT/DELETE` | `/v1/chatbots/{id}` | Chi tiết / cập nhật / xóa |
| `GET` | `/v1/chatbots/by-collection/{collection_id}` | Chatbot nào đang dùng 1 bộ tri thức → `{in_use, chatbots[]}` (index-service gọi để **chặn xóa collection đang dùng**) |
| `GET` | `/v1/public/chatbots/{public_id}` | Cấu hình công khai cho widget |
| `GET` | `/v1/conversations` | Danh sách hội thoại |
| `GET` | `/v1/conversations/{id}/messages` | Lịch sử tin nhắn |

### 5.3. Widget nhúng (static)

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/dist/sdk.js` | Mã SDK widget |
| `GET` | `/widget/{path}` | Tài nguyên tĩnh widget |

> **Snippet nhúng** dùng thuộc tính `data-*` trên thẻ `<script>`:
> `data-api-url` (= `<domain>/api/chatbot`), `data-chatbot-id` (= `public_id`),
> `data-bot-name`, `data-position`.

---

## 6. Cấu hình Chatbot

| Trường | Mô tả |
|---|---|
| `name` | Tên hiển thị của bot |
| `purpose` / `form` | Mục đích; chế độ trả lời: `other` (text) · `voice` · `both` |
| `system_prompt` | Prompt hệ thống tùy biến cho từng bot |
| `faqs` | Danh sách Q&A mẫu (ưu tiên khớp khi hỏi gần giống) |
| `llm_provider` / `embedding_provider` | Provider LLM/Embedding (rỗng → mặc định `gemini`) |
| `widget_theme` | Cấu hình giao diện widget; `voiceName` chọn giọng đọc |
| bộ tri thức | Bảng `chatbot_collections`: 1..N collection gắn vào bot |

**Provider hỗ trợ:** `gemini` (mặc định), `openai`, `claude`, `foxaillm` — cho cả LLM và
Embedding. Giọng đọc TTS: lấy danh sách qua `GET /v1/tts/voices`, chọn theo lượt bằng
`voice_id`, hoặc đặt mặc định cho bot ở `widget_theme.voiceName` (tập giọng Gemini:
Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede).

---

## 7. Đồng bộ module phân quyền (Permission Module Sync)

Mỗi chatbot được "soi gương" thành một **phân hệ (module)** trong nhóm `CHATBOT_AI`
ở **system-service**, để hiện thành 1 dòng trong **ma trận phân quyền vai trò**
("Cấu hình vai trò" → nhóm "Chatbot AI thông minh").

### 7.1. Vòng đời

| Sự kiện chatbot | Gọi system-service (qua API Gateway) |
|---|---|
| Tạo bot | `GET /api/module-groups` (tìm `CHATBOT_AI`) → `POST /api/modules` |
| Đổi tên bot | tìm module theo `code` → `PATCH /api/modules/:id { name }` |
| Xóa bot | tìm module theo `code` → `DELETE /api/modules/:id` |

- **Module code** = `CHATBOT_<chatbot_uuid>` (bất biến, duy nhất); `sortOrder` = max+1 trong nhóm.
- Gọi qua **API Gateway** (`/api/modules`), **forward token người thao tác** — system-service
  enforce quyền `ROLE_CONFIG`.
- **Best-effort:** mọi lỗi (mạng / thiếu quyền) chỉ log cảnh báo, **không** làm hỏng việc
  tạo/sửa/xóa bot.
- FE ma trận **render động** từ `GET /api/module-groups` → module mới tự hiện, **không cần sửa FE**.

> **Giới hạn (do chọn forward-token):** chỉ khi người thao tác có quyền `ROLE_CONFIG`
> (SUPER_ADMIN/admin/KTNB) thì module mới đồng bộ. Manager thao tác → bỏ qua êm (403).
> Code đồng bộ nằm ở `joint/utils/system_modules.py` (chatbot-service); **không** sửa
> system-service.

---

## 8. Quy tắc nghiệp vụ (Business Rules)

### 8.1. Truy hồi & trả lời

| Rule | Mô tả |
|---|---|
| **BR-001** | Chỉ trả lời dựa trên tài liệu truy hồi của **lượt hiện tại**; không bịa, không lấy kiến thức nền của LLM |
| **BR-002** | Nếu không tìm thấy trong cơ sở tri thức → trả lời rõ "không tìm thấy", **không** tái dùng đáp án lượt trước |
| **BR-003** | Mỗi câu trả lời tài liệu phải kèm dòng **Source** (tài liệu, trang, hiệu lực) |
| **BR-004** | Bot gắn nhiều bộ tri thức → truy hồi **fan-out** tất cả collection rồi gộp/xếp hạng |

### 8.2. Embedding & nhất quán

| Rule | Mô tả |
|---|---|
| **BR-005** | Embedding khi index và khi truy vấn phải **cùng model** (`models/gemini-embedding-001`, 3072 chiều) — lệch model/chiều ⇒ truy hồi sai |
| **BR-006** | Thêm tài liệu = **upsert** vào collection (không xóa dữ liệu cũ); xóa tài liệu = xóa vector theo `document_name` |
| **BR-007** | Tài liệu embedding lỗi (vd hết quota/sai model) ⇒ 0 vector ⇒ bot không trả lời được nội dung đó → cần xóa & nạp lại |

### 8.3. Giọng nói

| Rule | Mô tả |
|---|---|
| **BR-008** | TTS (one-shot & inline) chỉ phục vụ chatbot ở chế độ `voice`/`both` |
| **BR-009** | Giọng nói streaming (`audio_chunk`) là **opt-in** qua `inline_audio=true`; mặc định tắt để không tốn quota |
| **BR-010** | `audio_chunk` phát theo `seq` tăng dần; lỗi TTS một câu thì bỏ qua audio câu đó, **text vẫn đầy đủ** |
| **BR-011** | Giọng đọc ưu tiên: `voice_id` (theo lượt) > `widget_theme.voiceName` (bot) > mặc định server; `voice_id` không hợp lệ ⇒ rơi về mặc định |

### 8.4. Bộ nhớ & hội thoại

| Rule | Mô tả |
|---|---|
| **BR-012** | Ngữ cảnh hội thoại tách biệt theo `conversation_id` (Redis checkpointer; khôi phục từ PostgreSQL khi cache hết hạn) |
| **BR-013** | Bộ nhớ Mem0 khóa theo `(user_id × chatbot_id)` — **không rò rỉ** giữa các chatbot khác nhau |
| **BR-014** | Hội thoại được tự sinh tiêu đề từ câu hỏi đầu tiên |

### 8.5. Đồng bộ module phân quyền

| Rule | Mô tả |
|---|---|
| **BR-015** | Tạo/đổi tên/xóa chatbot → tạo/sửa/xóa module `CHATBOT_<id>` trong nhóm `CHATBOT_AI` (best-effort, không làm hỏng CRUD bot) |
| **BR-016** | Đồng bộ qua gateway + forward token; **chỉ chạy khi người thao tác có `ROLE_CONFIG`** (manager → bỏ qua) |

---

## 9. Phụ thuộc & hạ tầng

| Thành phần | Vai trò |
|---|---|
| **Qdrant** (:6333) | Vector store — 1 collection / bộ tri thức |
| **PostgreSQL** (`chatbot_db`) | `chatbots`, `conversations`, `messages`, `chatbot_collections` |
| **Redis** | Checkpointer ngữ cảnh hội thoại |
| **MinIO** | Lưu tệp đính kèm / nguồn tài liệu |
| **Gemini / OpenAI / Claude / FoxAI LLM** | LLM + Embedding + TTS |
| **`index-service`** | Nạp/cắt chunk/embedding tài liệu vào Qdrant (xem [[Quan_ly_Tri_Thuc]]) |
| **`system-service`** (qua gateway) | Đăng ký module phân quyền cho mỗi chatbot (xem §7) |
