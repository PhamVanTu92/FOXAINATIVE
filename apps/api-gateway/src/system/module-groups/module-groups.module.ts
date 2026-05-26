import { Module } from '@nestjs/common';
import { SystemGrpcModule } from '../../grpc/system-grpc.module';
import { ModuleGroupsController } from './module-groups.controller';
import { ModuleGroupsService } from './module-groups.service';

@Module({
  imports: [SystemGrpcModule],
  controllers: [ModuleGroupsController],
  providers: [ModuleGroupsService],
})
export class ModuleGroupsModule {}
