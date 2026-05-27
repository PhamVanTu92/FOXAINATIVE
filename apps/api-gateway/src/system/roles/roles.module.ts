import { Module } from '@nestjs/common';
import { SystemGrpcModule } from '../../grpc/system-grpc.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [SystemGrpcModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
