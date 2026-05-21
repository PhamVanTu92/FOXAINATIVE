import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { SYSTEM_PACKAGE } from '../../grpc/system-grpc.module';
import { callGrpc } from '../../common/grpc/grpc-error-mapper';
import {
  GetPermissionRequest,
  ListPermissionsRequest,
  ListPermissionsResponse,
  PermissionDto,
  PermissionsGrpcService,
} from '../grpc-interfaces';

@Injectable()
export class PermissionsService implements OnModuleInit {
  private perms!: PermissionsGrpcService;

  constructor(@Inject(SYSTEM_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.perms = this.client.getService<PermissionsGrpcService>('PermissionsService');
  }

  list(req: ListPermissionsRequest, md?: Metadata): Promise<ListPermissionsResponse> {
    return callGrpc(this.perms.listPermissions(req, md));
  }

  get(req: GetPermissionRequest, md?: Metadata): Promise<PermissionDto> {
    return callGrpc(this.perms.getPermission(req, md));
  }
}
