# FOXAI API Gateway (NestJS)

REST gateway expose 29 HTTP endpoints, dịch sang gRPC gọi tới **System Service** (.NET 9 — User, RBAC, Org, JWT).

- **Framework:** NestJS 10 + Express
- **Transport tới upstream:** gRPC (HTTP/2)
- **Auth:** Verify JWT (HS256) local — cùng `JWT_SECRET` với System Service
- **Port:** `3001`
- **Rate limit:** 200 req/min/IP (Throttler)

---

## REST endpoints

### Auth (public — không cần JWT)

| Method | Path | gRPC |
|---|---|---|
| `POST` | `/api/auth/login` | `AuthService/Login` |
| `POST` | `/api/auth/refresh` | `AuthService/RefreshToken` |
| `POST` | `/api/auth/validate` | `AuthService/ValidateToken` |
| `POST` | `/api/auth/logout` | `AuthService/Logout` |

### Users (cần Bearer token)

| Method | Path | gRPC |
|---|---|---|
| `POST` | `/api/users` | `UsersService/CreateUser` |
| `GET` | `/api/users` (`?page&pageSize&search&sortBy&sortOrder&status&organizationId`) | `UsersService/ListUsers` |
| `GET` | `/api/users/:id` | `UsersService/GetUser` |
| `PATCH` | `/api/users/:id` | `UsersService/UpdateUser` |
| `DELETE` | `/api/users/:id` | `UsersService/DeleteUser` (soft → INACTIVE) |
| `POST` | `/api/users/:id/change-password` | `UsersService/ChangePassword` |
| `POST` | `/api/users/:id/change-status` (`{status: ACTIVE\|INACTIVE\|LOCKED}`) | `UsersService/ChangeStatus` |
| `POST` | `/api/users/:id/roles` (`{roleCode}`) | `UsersService/AssignRole` |
| `DELETE` | `/api/users/:id/roles/:roleCode` | `UsersService/UnassignRole` |

### Roles

| Method | Path | gRPC |
|---|---|---|
| `POST` | `/api/roles` | `RolesService/CreateRole` |
| `GET` | `/api/roles` (`?page&pageSize&search&includePermissions`) | `RolesService/ListRoles` |
| `GET` | `/api/roles/:id` | `RolesService/GetRole` |
| `PATCH` | `/api/roles/:id` | `RolesService/UpdateRole` |
| `DELETE` | `/api/roles/:id` | `RolesService/DeleteRole` |
| `POST` | `/api/roles/:id/permissions` (`{permissionCodes: [...]}`) | `RolesService/AssignPermissions` |
| `DELETE` | `/api/roles/:id/permissions` (`{permissionCodes: [...]}`) | `RolesService/RevokePermissions` |

### Permissions

| Method | Path | gRPC |
|---|---|---|
| `GET` | `/api/permissions` (`?module=USER`) | `PermissionsService/ListPermissions` |
| `GET` | `/api/permissions/:id` | `PermissionsService/GetPermission` |

### Organizations

| Method | Path | gRPC |
|---|---|---|
| `POST` | `/api/organizations` | `OrganizationsService/CreateNode` |
| `GET` | `/api/organizations/tree` (`?rootId`) | `OrganizationsService/GetTree` |
| `GET` | `/api/organizations/:id` | `OrganizationsService/GetNode` |
| `PATCH` | `/api/organizations/:id` | `OrganizationsService/UpdateNode` |
| `POST` | `/api/organizations/:id/move` (`{newParentId}`) | `OrganizationsService/MoveNode` |
| `DELETE` | `/api/organizations/:id` | `OrganizationsService/DeleteNode` |
| `GET` | `/api/organizations/:id/users` (`?page&pageSize&includeSubOrgs`) | `OrganizationsService/ListUsersByOrg` |

### Misc

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Health check (public) |
| `GET` | `/` | Service info (public) |

---

## gRPC status → HTTP status mapping

Định nghĩa trong [src/common/grpc/grpc-error-mapper.ts](src/common/grpc/grpc-error-mapper.ts).

| gRPC StatusCode | HTTP | Khi nào |
|---|---|---|
| `INVALID_ARGUMENT` (3) | `400` | FluentValidation fail, format sai (vd UUID, email) |
| `UNAUTHENTICATED` (16) | `401` | Email/password sai, token hết hạn |
| `PERMISSION_DENIED` (7) | `403` | Forbidden (chưa wire RBAC check chi tiết) |
| `NOT_FOUND` (5) | `404` | Entity không tồn tại |
| `ALREADY_EXISTS` (6) | `409` | Email/code đã dùng |
| `FAILED_PRECONDITION` (9) | `422` | Business rule violation (vd xóa node còn user, xóa system role, MoveNode tạo loop) |
| `INTERNAL` (13) | `500` | System Service crash |
| `UNAVAILABLE` (14) | `503` | gRPC channel down |

Response error format:
```json
{
  "statusCode": 422,
  "grpcCode": 9,
  "grpcStatus": "FAILED_PRECONDITION",
  "message": "Không thể xóa đơn vị tổ chức còn người dùng trực thuộc."
}
```

---

## Cấu trúc dự án

```
src/
├── main.ts                            CORS + ValidationPipe + listen
├── app.module.ts                      ConfigModule + JwtModule + Throttler + 5 feature modules
│
├── grpc/
│   └── system-grpc.module.ts          ClientsModule.registerAsync (proto loader, package=foxai.system+foxai.common)
│
├── common/
│   ├── auth/
│   │   ├── jwt-auth.guard.ts          APP_GUARD (default verify, bỏ qua route gắn @Public)
│   │   ├── current-user.decorator.ts  @CurrentUser, @AccessToken param decorators
│   │   └── public.decorator.ts        @Public() marker
│   └── grpc/
│       ├── grpc-error-mapper.ts       callGrpc<T>() + mapGrpcError()
│       └── grpc-metadata.helper.ts    buildForwardMetadata(token, user) → Authorization + x-user-id
│
├── health/
│   └── health.controller.ts           GET /health + /
│
└── system/
    ├── grpc-interfaces.ts             TS interfaces cho 5 gRPC services (auth/users/roles/permissions/organizations)
    ├── auth/                          {module, controller, service, dto/}
    ├── users/
    ├── roles/
    ├── permissions/
    └── organizations/
```

---

## Cấu hình env

| Biến | Default | Mô tả |
|---|---|---|
| `API_GATEWAY_PORT` | `3001` | Port HTTP gateway listen |
| `SYSTEM_SERVICE_GRPC_URL` | `localhost:51051` | URL gRPC tới System Service (cùng compose: `system-service:50051`) |
| `JWT_SECRET` | **required** | HS256 key — phải **giống hệt** secret System Service dùng để issue token |
| `JWT_ISSUER` | `foxai-system-service` | Validate `iss` claim |
| `JWT_AUDIENCE` | `foxai-platform` | Validate `aud` claim |
| `CORS_ORIGIN` | `*` | Comma-separated list cho CORS origins |

⚠️ **Pitfall thường gặp:** Nếu JWT verify trả `401 Invalid or expired token` mà System Service ValidateToken xác nhận token OK → **JWT_SECRET hai bên không khớp**. Check ngay env var của cả 2 process (đặc biệt khi 1 chạy native + 1 chạy Docker).

---

## Khởi động

### Native dev (cùng host với System Service)
```bash
# 1. System Service phải đang chạy (native hoặc Docker, port 51051)
# 2. Build + run Gateway
pnpm --filter @foxai/api-gateway build
JWT_SECRET="<same-as-system-service>" pnpm --filter @foxai/api-gateway start

# Hoặc watch mode:
pnpm --filter @foxai/api-gateway dev
```

### Smoke test
```powershell
# Login + lưu token
$login = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method POST `
  -Body (@{email='admin@foxai.local'; password='Admin@12345'} | ConvertTo-Json) `
  -ContentType 'application/json'

# Gọi protected endpoint
Invoke-RestMethod -Uri 'http://localhost:3001/api/users?page=1&pageSize=5' `
  -Headers @{Authorization="Bearer $($login.accessToken)"}
```

### Postman
Tất cả endpoint là REST chuẩn → Postman REST collection sẽ work bình thường (không cần gRPC support). User có thể tạo collection mới với 29 endpoint trên.

---

## JWT verify flow

```
1. Client gửi:    Authorization: Bearer eyJhbGc...
2. JwtAuthGuard:  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer, audience })
3. Inject req.user = { sub, email, name, roles[], permissions[], jti, iss, aud, exp, iat }
4. Forward metadata sang gRPC:
   authorization: Bearer eyJhbGc...   (cho audit log ở System Service)
   x-user-id: <sub>
   x-user-email: <email>
5. System Service nhận request đã có context user (qua metadata)
```

Route gắn `@Public()` decorator → skip guard (Auth endpoints).

---

## Tham chiếu

- System Service backend: [apps/system-service/README.md](../system-service/README.md)
- gRPC proto contracts: [packages/shared-proto/](../../packages/shared-proto/)
- Postman collection (cho gRPC, không phải Gateway): [docs/postman/](../../docs/postman/)
