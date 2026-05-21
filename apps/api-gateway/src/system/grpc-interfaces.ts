import { Metadata } from '@grpc/grpc-js';
import { Observable } from 'rxjs';

// ─── Common ─────────────────────────────────────────────────────────────────
export interface PageRequest {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface PageMetadata {
  page: number;
  pageSize: number;
  totalItems: string | number; // proto int64 -> string in grpc-js by default
  totalPages: number;
}

export interface EmptyResponse {}

// ─── Auth ───────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string | number;
  user: UserProfile;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ValidateTokenRequest {
  accessToken: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  user?: UserProfile;
  error?: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface AuthGrpcService {
  login(req: LoginRequest, md?: Metadata): Observable<LoginResponse>;
  refreshToken(req: RefreshTokenRequest, md?: Metadata): Observable<LoginResponse>;
  validateToken(req: ValidateTokenRequest, md?: Metadata): Observable<ValidateTokenResponse>;
  logout(req: LogoutRequest, md?: Metadata): Observable<EmptyResponse>;
}

// ─── Users ──────────────────────────────────────────────────────────────────
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  status: string;
  organizationId?: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  organizationId?: string;
  roleCodes?: string[];
}

export interface GetUserRequest { id: string; }
export interface DeleteUserRequest { id: string; }

export interface ListUsersRequest {
  pagination?: PageRequest;
  status?: string;
  organizationId?: string;
}
export interface ListUsersResponse {
  items: UserDto[];
  page: PageMetadata;
}

export interface UpdateUserRequest {
  id: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  organizationId?: string;
}

export interface ChangePasswordRequest {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

export interface ChangeStatusRequest {
  userId: string;
  status: string;
}

export interface AssignRoleRequest {
  userId: string;
  roleCode: string;
}

export interface UnassignRoleRequest {
  userId: string;
  roleCode: string;
}

export interface UsersGrpcService {
  createUser(req: CreateUserRequest, md?: Metadata): Observable<UserDto>;
  getUser(req: GetUserRequest, md?: Metadata): Observable<UserDto>;
  listUsers(req: ListUsersRequest, md?: Metadata): Observable<ListUsersResponse>;
  updateUser(req: UpdateUserRequest, md?: Metadata): Observable<UserDto>;
  deleteUser(req: DeleteUserRequest, md?: Metadata): Observable<EmptyResponse>;
  changePassword(req: ChangePasswordRequest, md?: Metadata): Observable<EmptyResponse>;
  changeStatus(req: ChangeStatusRequest, md?: Metadata): Observable<UserDto>;
  assignRole(req: AssignRoleRequest, md?: Metadata): Observable<EmptyResponse>;
  unassignRole(req: UnassignRoleRequest, md?: Metadata): Observable<EmptyResponse>;
}

// ─── Roles ──────────────────────────────────────────────────────────────────
export interface RoleDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  permissionCodes?: string[];
}

export interface GetRoleRequest { id: string; }
export interface DeleteRoleRequest { id: string; }

export interface ListRolesRequest {
  pagination?: PageRequest;
  includePermissions?: boolean;
}
export interface ListRolesResponse {
  items: RoleDto[];
  page: PageMetadata;
}

export interface UpdateRoleRequest {
  id: string;
  name?: string;
  description?: string;
}

export interface AssignPermissionsRequest {
  roleId: string;
  permissionCodes: string[];
}
export interface RevokePermissionsRequest {
  roleId: string;
  permissionCodes: string[];
}

export interface RolesGrpcService {
  createRole(req: CreateRoleRequest, md?: Metadata): Observable<RoleDto>;
  getRole(req: GetRoleRequest, md?: Metadata): Observable<RoleDto>;
  listRoles(req: ListRolesRequest, md?: Metadata): Observable<ListRolesResponse>;
  updateRole(req: UpdateRoleRequest, md?: Metadata): Observable<RoleDto>;
  deleteRole(req: DeleteRoleRequest, md?: Metadata): Observable<EmptyResponse>;
  assignPermissions(req: AssignPermissionsRequest, md?: Metadata): Observable<RoleDto>;
  revokePermissions(req: RevokePermissionsRequest, md?: Metadata): Observable<RoleDto>;
}

// ─── Permissions ────────────────────────────────────────────────────────────
export interface PermissionDto {
  id: string;
  code: string;
  name: string;
  module: string;
  action: string;
  resource: string;
}

export interface ListPermissionsRequest { module?: string; }
export interface ListPermissionsResponse { items: PermissionDto[]; }
export interface GetPermissionRequest { id: string; }

export interface PermissionsGrpcService {
  listPermissions(req: ListPermissionsRequest, md?: Metadata): Observable<ListPermissionsResponse>;
  getPermission(req: GetPermissionRequest, md?: Metadata): Observable<PermissionDto>;
}

// ─── Organizations ──────────────────────────────────────────────────────────
export interface OrganizationNodeDto {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  level: number;
  path: string;
  children?: OrganizationNodeDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNodeRequest {
  code: string;
  name: string;
  parentId?: string;
}

export interface GetNodeRequest { id: string; }
export interface DeleteNodeRequest { id: string; }

export interface GetTreeRequest { rootId?: string; }
export interface OrganizationTreeResponse { nodes: OrganizationNodeDto[]; }

export interface UpdateNodeRequest {
  id: string;
  name?: string;
}

export interface MoveNodeRequest {
  id: string;
  newParentId?: string;
}

export interface ListUsersByOrgRequest {
  organizationId: string;
  pagination?: PageRequest;
  includeSubOrgs?: boolean;
}

export interface OrganizationsGrpcService {
  createNode(req: CreateNodeRequest, md?: Metadata): Observable<OrganizationNodeDto>;
  getNode(req: GetNodeRequest, md?: Metadata): Observable<OrganizationNodeDto>;
  getTree(req: GetTreeRequest, md?: Metadata): Observable<OrganizationTreeResponse>;
  updateNode(req: UpdateNodeRequest, md?: Metadata): Observable<OrganizationNodeDto>;
  moveNode(req: MoveNodeRequest, md?: Metadata): Observable<OrganizationNodeDto>;
  deleteNode(req: DeleteNodeRequest, md?: Metadata): Observable<EmptyResponse>;
  listUsersByOrg(req: ListUsersByOrgRequest, md?: Metadata): Observable<ListUsersResponse>;
}
