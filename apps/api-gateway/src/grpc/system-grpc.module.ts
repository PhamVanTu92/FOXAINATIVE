import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

export const SYSTEM_PACKAGE = 'SYSTEM_PACKAGE';

const PROTO_ROOT = join(__dirname, '..', '..', '..', '..', 'packages', 'shared-proto', 'proto');

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: SYSTEM_PACKAGE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cfg: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            // Tất cả service đều thuộc package proto `foxai.system`; common types `foxai.common`.
            package: ['foxai.system', 'foxai.common'],
            protoPath: [
              join(PROTO_ROOT, 'system', 'auth.proto'),
              join(PROTO_ROOT, 'system', 'users.proto'),
              join(PROTO_ROOT, 'system', 'roles.proto'),
              join(PROTO_ROOT, 'system', 'permissions.proto'),
              join(PROTO_ROOT, 'system', 'organizations.proto'),
            ],
            loader: {
              keepCase: false, // snake_case -> camelCase
              longs: String, // int64 → string (tránh BigInt issue)
              enums: String,
              defaults: true,
              oneofs: true,
              includeDirs: [PROTO_ROOT],
            },
            url: cfg.get<string>('SYSTEM_SERVICE_GRPC_URL') ?? 'localhost:51051',
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class SystemGrpcModule {}
