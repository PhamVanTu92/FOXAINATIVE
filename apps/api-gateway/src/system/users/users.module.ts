import { Module } from '@nestjs/common';
import { SystemGrpcModule } from '../../grpc/system-grpc.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SystemGrpcModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
