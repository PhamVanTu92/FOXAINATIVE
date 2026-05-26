import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

export const KNOWLEDGE_PACKAGE = 'KNOWLEDGE_PACKAGE';

const PROTO_ROOT = join(__dirname, '..', '..', '..', '..', 'packages', 'shared-proto', 'proto');

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KNOWLEDGE_PACKAGE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cfg: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'foxai.knowledge',
            protoPath: join(PROTO_ROOT, 'knowledge', 'knowledge.proto'),
            loader: {
              keepCase: false,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
              includeDirs: [PROTO_ROOT],
            },
            url: cfg.get<string>('KNOWLEDGE_SERVICE_GRPC_URL') ?? 'localhost:52052',
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KnowledgeGrpcModule {}
