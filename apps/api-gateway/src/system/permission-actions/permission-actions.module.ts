import { Module } from '@nestjs/common';
import { SystemGrpcModule } from '../../grpc/system-grpc.module';
import { PermissionActionsController } from './permission-actions.controller';
import { PermissionActionsService } from './permission-actions.service';

@Module({
  imports: [SystemGrpcModule],
  controllers: [PermissionActionsController],
  providers: [PermissionActionsService],
})
export class PermissionActionsModule {}
