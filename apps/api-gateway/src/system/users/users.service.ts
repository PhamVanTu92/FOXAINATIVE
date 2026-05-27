import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { SYSTEM_PACKAGE } from '../../grpc/system-grpc.module';
import { callGrpc } from '../../common/grpc/grpc-error-mapper';
import {
  AssignRoleRequest,
  ChangePasswordRequest,
  ChangeStatusRequest,
  CreateUserRequest,
  DeleteUserRequest,
  GetUserPermissionsRequest,
  GetUserRequest,
  ListUsersRequest,
  ListUsersResponse,
  SetUserPermissionsRequest,
  UnassignRoleRequest,
  UpdateUserRequest,
  UserDto,
  UserPermissionsResponse,
  UsersGrpcService,
} from '../grpc-interfaces';

@Injectable()
export class UsersService implements OnModuleInit {
  private users!: UsersGrpcService;

  constructor(@Inject(SYSTEM_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.users = this.client.getService<UsersGrpcService>('UsersService');
  }

  create(req: CreateUserRequest, md?: Metadata): Promise<UserDto> {
    return callGrpc(this.users.createUser(req, md));
  }
  get(req: GetUserRequest, md?: Metadata): Promise<UserDto> {
    return callGrpc(this.users.getUser(req, md));
  }
  list(req: ListUsersRequest, md?: Metadata): Promise<ListUsersResponse> {
    return callGrpc(this.users.listUsers(req, md));
  }
  update(req: UpdateUserRequest, md?: Metadata): Promise<UserDto> {
    return callGrpc(this.users.updateUser(req, md));
  }
  remove(req: DeleteUserRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.users.deleteUser(req, md)).then(() => undefined);
  }
  changePassword(req: ChangePasswordRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.users.changePassword(req, md)).then(() => undefined);
  }
  changeStatus(req: ChangeStatusRequest, md?: Metadata): Promise<UserDto> {
    return callGrpc(this.users.changeStatus(req, md));
  }
  assignRole(req: AssignRoleRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.users.assignRole(req, md)).then(() => undefined);
  }
  unassignRole(req: UnassignRoleRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.users.unassignRole(req, md)).then(() => undefined);
  }
  getPermissions(req: GetUserPermissionsRequest, md?: Metadata): Promise<UserPermissionsResponse> {
    return callGrpc(this.users.getUserPermissions(req, md));
  }
  setPermissions(req: SetUserPermissionsRequest, md?: Metadata): Promise<UserPermissionsResponse> {
    return callGrpc(this.users.setUserPermissions(req, md));
  }
}
