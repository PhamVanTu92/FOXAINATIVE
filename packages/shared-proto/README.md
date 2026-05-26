# @foxai/shared-proto

Shared gRPC protocol buffer definitions cho hệ thống FOXAI Native.

## Cấu trúc

```
proto/
├── common/                Common messages (pagination, error)
└── system/                System Service contracts (auth, users, roles, permissions, organizations)
gen/ts/                    Generated TypeScript stubs (gitignored)
```

## Sử dụng

### .NET (Server / Client)

Include trực tiếp trong `.csproj`:

```xml
<ItemGroup>
  <Protobuf Include="..\..\..\..\packages\shared-proto\proto\system\*.proto"
            GrpcServices="Server"
            ProtoRoot="..\..\..\..\packages\shared-proto\proto" />
  <Protobuf Include="..\..\..\..\packages\shared-proto\proto\common\*.proto"
            GrpcServices="None"
            ProtoRoot="..\..\..\..\packages\shared-proto\proto" />
</ItemGroup>
```

`Grpc.Tools` sẽ tự sinh stubs khi build.

### TypeScript (Node — API Gateway)

```bash
pnpm --filter @foxai/shared-proto gen:ts
```

Script chạy `ts-proto` với plugin `@grpc/grpc-js`, output ra `gen/ts/`.

## Package naming convention

Tất cả message thuộc namespace `foxai.<domain>` (vd `foxai.system.AuthService`).

## Adding new proto

1. Tạo file mới trong `proto/<domain>/`.
2. Thêm `package foxai.<domain>;` và `option csharp_namespace = "Foxai.<Domain>";`.
3. Update README service tương ứng.
4. Regenerate stubs ở consumer.
