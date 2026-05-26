# Postman Collection — FOXAI System Service

Bộ test cho gRPC service tại `localhost:51051` (29 RPC trên 5 services: Auth, Users, Roles, Permissions, Organizations).

## Files

| File | Mô tả |
|---|---|
| [FOXAI-SystemService.postman_collection.json](FOXAI-SystemService.postman_collection.json) | Collection — payload reference cho 29 RPC + 1 health check |
| [FOXAI-SystemService.postman_environment.json](FOXAI-SystemService.postman_environment.json) | Environment — biến `host`, `port`, `accessToken`, `testUserId`, … |
| [grpcurl-smoke-test.ps1](grpcurl-smoke-test.ps1) | PowerShell script chạy smoke test full flow qua `grpcurl` |

---

## Import vào Postman

1. **Postman** → **Import** → kéo thả 2 file `.json` (collection + environment).
2. Bên phải, dropdown **Environment** chọn **FOXAI System Service - Local**.
3. Sửa nhanh nếu cần: env `port = 51051` (mặc định) hoặc `50051` nếu chạy native không gặp Windows port reservation.

---

## ⚠️ Lưu ý quan trọng về format collection

Postman có 2 loại request riêng biệt: **HTTP Request** và **gRPC Request**, và collection format không 1:1 chuyển đổi được.

**Collection này được export ở format HTTP** (URL `grpc://...`, body JSON) — đóng vai trò **payload reference + documentation**, không tự invoke gRPC khi click Send.

**Cách dùng đúng:**
1. Mở 1 item trong collection (vd `Login`) → copy body JSON
2. Tạo gRPC Request mới: **New → gRPC Request**
3. **Server URL:** `localhost:51051`
4. **Use server reflection: ON** ← service đã enable reflection ở Dev mode
5. Postman tự discover services → chọn `foxai.system.AuthService` → method `Login`
6. **Message** tab: paste payload từ collection
7. **Invoke** → response trả về

Lý do: Postman gRPC native format chứa metadata gắn với proto files local — không portable qua JSON export. Đây là [hạn chế đã biết](https://learning.postman.com/docs/sending-requests/grpc/grpc-request-interface/) của Postman.

---

## Quy trình test full flow (qua Postman gRPC UI)

### Bước 1: Login (lấy access token)

1. New gRPC Request → URL `localhost:51051` → Use reflection ON
2. Service: `foxai.system.AuthService` → Method: `Login`
3. Message:
   ```json
   { "email": "admin@foxai.local", "password": "Admin@12345" }
   ```
4. Invoke → copy `access_token` từ response
5. Postman → Environment **FOXAI System Service - Local** → Edit → set giá trị `accessToken`

### Bước 2: Authenticated request (vd ListUsers)

1. New gRPC Request → URL `localhost:51051` → Use reflection ON
2. Service: `foxai.system.UsersService` → Method: `ListUsers`
3. **Metadata** tab: add key `authorization`, value `Bearer {{accessToken}}`
4. Message:
   ```json
   { "pagination": { "page": 1, "pageSize": 20 } }
   ```
5. Invoke

### Bước 3: Lặp lại cho mọi RPC khác

Lookup payload + description trong collection HTTP. Tất cả 29 RPC có sample payload + business rules + expected errors.

---

## Backup: grpcurl smoke test

Nếu không muốn dùng Postman GUI, chạy script PowerShell có sẵn để smoke test toàn bộ flow:

```powershell
# Yêu cầu: grpcurl (choco install grpcurl)
.\docs\postman\grpcurl-smoke-test.ps1
```

Script sẽ:
1. Health check
2. Login → save access token
3. List + filter permissions
4. Create role + assign permissions
5. Create org tree (root + child)
6. Create user gán vào org + role
7. Login với user mới
8. Logout

Output mỗi step show status (✓ pass / ✗ fail) + chi tiết response.

---

## gRPC reflection — chỉ hoạt động ở Development mode

`Program.cs` chỉ map reflection service khi `IsDevelopment()`:

```csharp
if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

**Khi chạy native (`pnpm dev`)** — env mặc định Development → Postman/grpcui tự discover OK.

**Khi chạy qua docker-compose** — env mặc định Production → reflection tắt. Để bật:
```yaml
# docker-compose.yml
system-service:
  environment:
    ASPNETCORE_ENVIRONMENT: Development  # override
```

Hoặc import manual file `.proto` từ `packages/shared-proto/proto/system/*.proto` vào Postman.

---

## Workflow điển hình (so sánh các tool)

| Tool | Setup | Ưu | Nhược |
|---|---|---|---|
| **Postman** (recommended) | Cài app, import collection làm reference | UI thân thiện, lưu collection chia sẻ team, env vars | Cần tạo gRPC Request thủ công (collection không invoke trực tiếp được) |
| **grpcui** | `go install ...` hoặc download binary, chạy `grpcui -plaintext localhost:51051` | Web UI giống Swagger nhất, auto-discover qua reflection | Cần Go SDK hoặc binary, không lưu collection |
| **grpcurl** | `choco install grpcurl` | CLI, scriptable, perfect cho CI | Không có UI, syntax dài |

Khuyến nghị: **Postman + reflection** cho dev hàng ngày, **grpcurl script** cho smoke test/CI.
