import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { SYSTEM_PACKAGE } from '../../grpc/system-grpc.module';
import { callGrpc } from '../../common/grpc/grpc-error-mapper';
import {
  AssignPermissionsRequest,
  CreateRoleRequest,
  DeleteRoleRequest,
  GetRoleRequest,
  ListRolesRequest,
  ListRolesResponse,
  RevokePermissionsRequest,
  RoleDto,
  RolesGrpcService,
  UpdateRoleRequest,
} from '../grpc-interfaces';

@Injectable()
export class RolesService implements OnModuleInit {
  private roles!: RolesGrpcService;

  constructor(@Inject(SYSTEM_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.roles = this.client.getService<RolesGrpcService>('RolesService');
  }

  create(req: CreateRoleRequest, md?: Metadata): Promise<RoleDto> {
    return callGrpc(this.roles.createRole(req, md));
  }
  get(req: GetRoleRequest, md?: Metadata): Promise<RoleDto> {
    return callGrpc(this.roles.getRole(req, md));
  }
  list(req: ListRolesRequest, md?: Metadata): Promise<ListRolesResponse> {
    return callGrpc(this.roles.listRoles(req, md));
  }
  update(req: UpdateRoleRequest, md?: Metadata): Promise<RoleDto> {
    return callGrpc(this.roles.updateRole(req, md));
  }
  remove(req: DeleteRoleRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.roles.deleteRole(req, md)).then(() => undefined);
  }
  assignPermissions(req: AssignPermissionsRequest, md?: Metadata): Promise<RoleDto> {
    return callGrpc(this.roles.assignPermissions(req, md));
  }
  revokePermissions(req: RevokePermissionsRequest, md?: Metadata): Promise<RoleDto> {
    return callGrpc(this.roles.revokePermissions(req, md));
  }
}
