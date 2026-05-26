import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { SYSTEM_PACKAGE } from '../../grpc/system-grpc.module';
import { callGrpc } from '../../common/grpc/grpc-error-mapper';
import {
  CreatePermissionActionRequest,
  DeletePermissionActionRequest,
  GetPermissionActionRequest,
  ListPermissionActionsRequest,
  ListPermissionActionsResponse,
  PermissionActionDto,
  PermissionActionsGrpcService,
  UpdatePermissionActionRequest,
} from '../grpc-interfaces';

@Injectable()
export class PermissionActionsService implements OnModuleInit {
  private svc!: PermissionActionsGrpcService;

  constructor(@Inject(SYSTEM_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.svc = this.client.getService<PermissionActionsGrpcService>('PermissionActionsService');
  }

  list(req: ListPermissionActionsRequest, md?: Metadata): Promise<ListPermissionActionsResponse> {
    return callGrpc(this.svc.listPermissionActions(req, md));
  }
  get(req: GetPermissionActionRequest, md?: Metadata): Promise<PermissionActionDto> {
    return callGrpc(this.svc.getPermissionAction(req, md));
  }
  create(req: CreatePermissionActionRequest, md?: Metadata): Promise<PermissionActionDto> {
    return callGrpc(this.svc.createPermissionAction(req, md));
  }
  update(req: UpdatePermissionActionRequest, md?: Metadata): Promise<PermissionActionDto> {
    return callGrpc(this.svc.updatePermissionAction(req, md));
  }
  remove(req: DeletePermissionActionRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.svc.deletePermissionAction(req, md)).then(() => undefined);
  }
}
