import { Module } from '@nestjs/common';
import { SystemGrpcModule } from '../../grpc/system-grpc.module';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';

@Module({
  imports: [SystemGrpcModule],
  controllers: [ModulesController],
  providers: [ModulesService],
})
export class ModulesModule {}
