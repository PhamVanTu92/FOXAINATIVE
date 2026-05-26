import { Module } from '@nestjs/common';
import { SystemGrpcModule } from '../../grpc/system-grpc.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [SystemGrpcModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
