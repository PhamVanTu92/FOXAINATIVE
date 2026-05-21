# FOXAI System Service (.NET 9 + gRPC)

Backend service quản lý **Users**, **RBAC (Roles + Permissions)**, **cơ cấu tổ chức cây**, và **cấp/verify JWT** cho toàn hệ thống FOXAINATIVE.

- **Ngôn ngữ:** C# 12 / .NET 9
- **Giao thức:** gRPC (HTTP/2) cho service-to-service, REST `/health` cho probe
- **DB:** PostgreSQL 16 (database `system_db`), EF Core 9 Code-First
- **Auth:** HS256 JWT do service phát hành, refresh token stateful (SHA256 hash, rotate-on-use)
- **Kiến trúc:** Clean Architecture (Domain / Application / Infrastructure / Api) + MediatR CQRS

---

## Cấu trúc dự án

```
src/
├── SystemService.Domain/         # Entities, value objects, domain exceptions
├── SystemService.Application/    # MediatR handlers + validators + abstractions
├── SystemService.Infrastructure/ # EF Core DbContext + repositories + JWT + BCrypt
└── SystemService.Api/            # gRPC services + interceptors + Program.cs

tests/
├── SystemService.UnitTests/        # xUnit + FluentAssertions
└── SystemService.IntegrationTests/ # WebApplicationFactory + Testcontainers PostgreSQL
```

Proto contracts: [`packages/shared-proto/proto/system/`](../../packages/shared-proto/proto/system/).

---

## Yêu cầu cài đặt

- .NET SDK **9.0.100+** (`dotnet --version`)
- Docker Desktop (chạy PostgreSQL + integration tests)
- `dotnet ef` global tool: `dotnet tool install -g dotnet-ef`

---

## Khởi động local

```bash
# 1. Hạ tầng (PostgreSQL system_db + Redis)
pnpm docker:up

# 2. Apply EF Core migrations
pnpm db:system:migrate
#  ↳ Khi service chạy lần đầu ở Development hoặc Test, migration + seed sẽ tự chạy.

# 3. Run service ở chế độ watch
pnpm --filter @foxai/system-service dev
#  ↳ gRPC: http://localhost:51051
#    Health: http://localhost:3002/health
#  Note: dùng 51051 (không phải 50051) vì Windows reserve dải 49960-50059 cho HyperV/WSL2.
```

Seed mặc định:
- Admin: `admin@foxai.local` / `Admin@12345` (role `SUPER_ADMIN`)
- 3 roles hệ thống: `SUPER_ADMIN`, `ADMIN`, `USER`
- 25 permissions cốt lõi (USER_*, ROLE_*, PERMISSION_*, ORG_*, OCR_*, CHATBOT_*, SYSTEM_ADMIN)

---

## gRPC services exposed

| Service | RPC count | Use case |
|---|---|---|
| `foxai.system.AuthService` | 4 | Login, RefreshToken (rotate), ValidateToken, Logout |
| `foxai.system.UsersService` | 9 | CRUD + ChangePassword + ChangeStatus + AssignRole/Unassign |
| `foxai.system.RolesService` | 7 | CRUD + AssignPermissions/Revoke |
| `foxai.system.PermissionsService` | 2 | ListPermissions (filter by module), GetPermission |
| `foxai.system.OrganizationsService` | 7 | Create/Get/Tree/Update/Move/Delete + ListUsersByOrg |

JWT claims khi Login thành công: `sub` (Guid), `email`, `name`, `roles[]`, `permissions[]`, `iat`, `exp`, `jti`, `iss=foxai-system-service`, `aud=foxai-platform`.

Refresh token: 30 ngày, lưu SHA256 hash trong bảng `refresh_tokens`, rotate mỗi lần `RefreshToken` RPC được gọi (token cũ bị revoke).

---

## Biến môi trường

| Biến | Default | Mô tả |
|---|---|---|
| `SYSTEM_DATABASE_URL` | `postgresql://system_user:system_pass@localhost:5432/system_db` | Prisma-style URL, tự convert sang Npgsql |
| `JWT_SECRET` | (required, ≥ 32 chars) | HS256 signing key — share với API Gateway |
| `JWT_EXPIRES_IN` | `7d` | TTL access token (`s`/`m`/`h`/`d`) |
| `Jwt:Issuer` | `foxai-system-service` | JWT `iss` claim |
| `Jwt:Audience` | `foxai-platform` | JWT `aud` claim |
| `Jwt:RefreshTokenDays` | `30` | Refresh token TTL |
| `GRPC_PORT` | `51051` (native) / `50051` (container) | Kestrel HTTP/2 listen port |
| `HTTP_PORT` | `3002` | Health check HTTP port |
| `SYSTEM_SERVICE_AUTOMIGRATE` | `true` (Docker) | Chạy migration khi startup |
| `SYSTEM_SERVICE_SEED` | `true` (Docker) | Seed admin + roles + permissions |

---

## Migration

```bash
# Tạo migration mới
pnpm db:system:migration:add MigrationName

# Apply migration
pnpm db:system:migrate

# Reset DB (DROP + apply lại tất cả)
pnpm db:system:reset

# Rollback migration cuối
pnpm db:system:migration:remove
```

---

## Testing

```bash
# Unit tests
pnpm --filter @foxai/system-service test:unit

# Integration tests (cần Docker — Testcontainers tự pull postgres:16-alpine)
pnpm --filter @foxai/system-service test:integration

# Tất cả tests
pnpm --filter @foxai/system-service test
```

Hiện trạng: **35 integration tests** cover end-to-end gRPC flow cho cả 5 service (Auth 7 + Users 10 + Roles 7 + Permissions 2 + Organizations 9).

---

## Docker

```bash
# Build image
docker build -f apps/system-service/Dockerfile -t foxai/system-service:dev .

# Run qua docker-compose (cùng PostgreSQL + Redis)
docker compose up -d system-service

# Logs
docker compose logs -f system-service
```

**Lưu ý port trên Windows (HyperV/WSL2 reserve dải `49960-50059`):**

| Mode | Client URL | Note |
|---|---|---|
| Native `dotnet run` trên host | `localhost:51051` | Kestrel listen 51051 trực tiếp (xem `launchSettings.json`) |
| Docker compose: host gọi vào | `localhost:51051` | Host port mapping `51051:50051` |
| Docker compose: service ↔ service | `system-service:50051` | Internal port, không qua Windows port stack |

API Gateway (NestJS) cấu hình `SYSTEM_SERVICE_GRPC_URL` trong `.env`:
- Khi chạy native trên host: `localhost:51051`
- Khi chạy trong cùng compose: `system-service:50051`

---

## Error handling

Domain exceptions được map sang gRPC StatusCode bởi `ExceptionInterceptor`:

| Exception | gRPC StatusCode |
|---|---|
| `EmailAlreadyExistsException`, `CodeAlreadyExistsException` | `AlreadyExists` |
| `NotFoundException` | `NotFound` |
| `FluentValidation.ValidationException`, `DomainValidationException` | `InvalidArgument` (kèm trailing metadata) |
| `UnauthorizedException` | `Unauthenticated` |
| `ForbiddenException` | `PermissionDenied` |
| `CircularOrganizationTreeException`, `SystemRoleProtectedException`, `BusinessRuleViolationException` | `FailedPrecondition` |
| Unhandled `Exception` | `Internal` (log full stack, trả message generic) |

---

## Tham chiếu

- Đặc tả kiến trúc tổng thể: [docs/Tech_Stack_Architecture.md](../../docs/Tech_Stack_Architecture.md)
- Shared proto contracts: [packages/shared-proto/README.md](../../packages/shared-proto/README.md)
- Shared TypeScript types: [packages/shared-types/](../../packages/shared-types/)
