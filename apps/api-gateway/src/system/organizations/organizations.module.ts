import { Module } from '@nestjs/common';
import { SystemGrpcModule } from '../../grpc/system-grpc.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [SystemGrpcModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
