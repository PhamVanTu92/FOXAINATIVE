# Chatbot Python Services — Port Notes

Branch: `tupv/chatbot-port` (commit khởi tạo các service Python).

## Tóm tắt

Folder `apps/chatbot-service/` (trước đây là scaffold NestJS rỗng) đã được thay
thế bằng implementation **Python/FastAPI** lấy từ demo
`/home/tupv/foxai_native_v1/native_chatbot_poc`. Thêm `apps/index-service/`
(cũng Python) để xử lý ingest tài liệu / vector store.

| Thành phần | Trước | Sau |
|---|---|---|
| `apps/chatbot-service` | NestJS scaffold (main.ts + app.module.ts) | **Python FastAPI** — chat orchestrator, chatbot CRUD, TTS, widget SDK |
| `apps/index-service` | _(chưa có)_ | **Python FastAPI** — document upload, chunking, embedding, Qdrant indexing |
| `apps/chatbot-service/widget/sdk/` | _(chưa có)_ | **TypeScript widget SDK** — embeddable chat + STT + TTS |
| `packages/chatbot-db/` (Prisma) | Có | **Không dùng nữa** — Python service tự quản lý schema bằng Alembic |
| `docker-compose.yml` | 3 PG + Redis + system-service + OCR | **+ qdrant + minio + 2 PG Python + 2 service Python** |

## Quyết định kiến trúc

### JWT auth
Bỏ Keycloak. Chatbot/Index service verify HS256 JWT do `system-service` .NET phát
hành. Code mới ở `apps/{chatbot,index}-service/api/helpers/dependencies/shared_auth.py`:
- Algorithm: HS256
- Secret: `JWT_SECRET` env (PHẢI khớp giữa system-service và 2 Python service)
- Issuer: `foxai-system-service`
- Audience: `foxai-platform`
- Claims map: `sub` → user_id, `name` → username, `email`, `roles[]`, `permissions[]`

Class `KeycloakSettings` được giữ dạng stub (mọi field default rỗng) để code cũ
import được. Nên xóa hoàn toàn ở PR dọn dẹp sau.

### DB
3 Postgres riêng cho Python service:
- `chatbot-py-postgres` (port host `5436`) — conversations, messages, chatbots, chatbot_collections
- `index-py-postgres` (port host `5435`) — collections, documents, chunks
- Không dùng `chatbot-db` Prisma — boss đang giữ nguyên để dành cho hướng NestJS sau này.

### Schema riêng
Python service dùng **Alembic** + SQLAlchemy. Migrations đi kèm trong
`apps/{chatbot,index}-service/joint/postgres/migrations/versions/`. Khi service
khởi động lần đầu, container `chatbot-py-migration` / `index-py-migration` chạy
`alembic upgrade head` rồi exit.

### Inter-service & API Gateway
Hiện tại web-portal sẽ gọi **trực tiếp** vào 2 service Python (chưa proxy qua
api-gateway). Việc thêm route proxy vào api-gateway NestJS có thể làm sau —
khuyến nghị mở PR riêng để giữ commit này focused.

Suggested routes nếu/khi thêm:
```
GET    /api/chatbot/v1/chatbots                  → chatbot-service:8000
POST   /api/chatbot/v1/chatbots
GET    /api/public/chatbot/v1/public/chatbots/:id → chatbot-service (no auth)
POST   /api/chatbot/v1/agents/public/chat/public/stream → SSE passthrough
POST   /api/chatbot/v1/tts/synthesize            → audio/wav response
POST   /api/index/v1/collections                 → index-service:8000
```

### Widget SDK
Đặt trong `apps/chatbot-service/widget/sdk/` (giữ nguyên cấu trúc gốc — SDK là
"con" của chatbot-service vì chatbot-service serve `/dist/sdk.js` qua FastAPI
static route).

Build: `cd apps/chatbot-service/widget/sdk && pnpm install && NODE_ENV=production pnpm build`
(hoặc `npm`). Sản phẩm `dist/sdk.js` được FastAPI mount static.

## Chạy

```bash
# 1. Copy env templates
cp apps/chatbot-service/.env.example apps/chatbot-service/.env
cp apps/index-service/.env.example apps/index-service/.env
#    điền JWT_SECRET (cùng giá trị với system-service), API keys LLM, ...

# 2. Build + up
docker compose up -d chatbot-py-postgres index-py-postgres redis qdrant minio
docker compose up -d chatbot-py-migration index-py-migration
docker compose up -d chatbot-service index-service

# 3. (Khi đã có api-gateway proxy hoặc test trực tiếp)
curl -X POST http://localhost:3004/v1/public/chatbots/<public_id>  # widget config
curl -X POST http://localhost:3004/v1/agents/public/chat/public/stream -d '{...}'  # chat
```

## TODO (ngoài scope commit này)

- [ ] Web-portal (Next.js): port các page chatbot config từ Vue demo
      (`/home/tupv/foxai_native_v1/FE_Native/src/views/pages/Chatbot/`)
- [ ] API Gateway: thêm proxy module cho 2 service Python
- [ ] Cleanup: xóa hẳn `apps/chatbot-service/joint/settings/models/keycloak.py`
      và `KeycloakSettings` field trong `settings.py` sau khi confirm không còn
      code import
- [ ] Cân nhắc gộp Mem0/Redis dùng chung instance Redis với BullMQ workers (hiện
      tại cùng container `redis`, khác keyspace)
- [ ] Port Python service sang NestJS (long term, nếu boss muốn tech stack đồng nhất)
