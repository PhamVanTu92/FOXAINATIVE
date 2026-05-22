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
  // Username (lowercase) hoặc email — server tự detect.
  login: string;
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
  username: string;
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
  username: string;
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

// ─── User permission overrides (grid "Phân quyền: <user>") ──────────────────
export interface UserPermissionPair {
  moduleId: string;
  actionId: string;
}

export interface GetUserPermissionsRequest {
  userId: string;
}

export interface SetUserPermissionsRequest {
  userId: string;
  effectiveGrants: UserPermissionPair[];
}

export interface UserPermissionCell {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  actionId: string;
  actionCode: string;
  actionName: string;
}

export interface UserPermissionOverrideCell {
  moduleId: string;
  moduleCode: string;
  actionId: string;
  actionCode: string;
  effect: 'GRANT' | 'DENY';
}

export interface UserPermissionsResponse {
  userId: string;
  roleGrants: UserPermissionCell[];
  overrides: UserPermissionOverrideCell[];
  effective: UserPermissionCell[];
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
  getUserPermissions(req: GetUserPermissionsRequest, md?: Metadata): Observable<UserPermissionsResponse>;
  setUserPermissions(req: SetUserPermissionsRequest, md?: Metadata): Observable<UserPermissionsResponse>;
}

// ─── Roles ──────────────────────────────────────────────────────────────────
export interface RoleGrantDto {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  actionId: string;
  actionCode: string;
  actionName: string;
}

export interface RolePermissionPair {
  moduleId: string;
  actionId: string;
}

export interface RoleDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  grants: RoleGrantDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequest {
  code?: string; // optional: server tự sinh từ name nếu bỏ trống
  name: string;
  description?: string;
}

export interface GetRoleRequest { id: string; }
export interface DeleteRoleRequest { id: string; }

export interface ListRolesRequest {
  pagination?: PageRequest;
  includeGrants?: boolean;
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
  grants: RolePermissionPair[];
}
export interface RevokePermissionsRequest {
  roleId: string;
  grants: RolePermissionPair[];
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

// ─── Module Groups ──────────────────────────────────────────────────────────
export interface ModuleSummaryDto {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ModuleGroupDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  modules: ModuleSummaryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ListModuleGroupsRequest { activeOnly?: boolean; }
export interface ListModuleGroupsResponse { items: ModuleGroupDto[]; }
export interface GetModuleGroupRequest { id: string; }
export interface DeleteModuleGroupRequest { id: string; }
export interface CreateModuleGroupRequest {
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
}
export interface UpdateModuleGroupRequest {
  id: string;
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ModuleGroupsGrpcService {
  listModuleGroups(req: ListModuleGroupsRequest, md?: Metadata): Observable<ListModuleGroupsResponse>;
  getModuleGroup(req: GetModuleGroupRequest, md?: Metadata): Observable<ModuleGroupDto>;
  createModuleGroup(req: CreateModuleGroupRequest, md?: Metadata): Observable<ModuleGroupDto>;
  updateModuleGroup(req: UpdateModuleGroupRequest, md?: Metadata): Observable<ModuleGroupDto>;
  deleteModuleGroup(req: DeleteModuleGroupRequest, md?: Metadata): Observable<EmptyResponse>;
}

// ─── Modules ────────────────────────────────────────────────────────────────
export interface ModuleDto {
  id: string;
  groupId: string;
  groupCode: string;
  groupName: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListModulesRequest { groupId?: string; activeOnly?: boolean; }
export interface ListModulesResponse { items: ModuleDto[]; }
export interface GetModuleRequest { id: string; }
export interface DeleteModuleRequest { id: string; }
export interface CreateModuleRequest {
  groupId: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
}
export interface UpdateModuleRequest {
  id: string;
  groupId?: string;
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ModulesGrpcService {
  listModules(req: ListModulesRequest, md?: Metadata): Observable<ListModulesResponse>;
  getModule(req: GetModuleRequest, md?: Metadata): Observable<ModuleDto>;
  createModule(req: CreateModuleRequest, md?: Metadata): Observable<ModuleDto>;
  updateModule(req: UpdateModuleRequest, md?: Metadata): Observable<ModuleDto>;
  deleteModule(req: DeleteModuleRequest, md?: Metadata): Observable<EmptyResponse>;
}

// ─── Permission Actions ─────────────────────────────────────────────────────
export interface PermissionActionDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListPermissionActionsRequest { activeOnly?: boolean; }
export interface ListPermissionActionsResponse { items: PermissionActionDto[]; }
export interface GetPermissionActionRequest { id: string; }
export interface DeletePermissionActionRequest { id: string; }
export interface CreatePermissionActionRequest {
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
}
export interface UpdatePermissionActionRequest {
  id: string;
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface PermissionActionsGrpcService {
  listPermissionActions(req: ListPermissionActionsRequest, md?: Metadata): Observable<ListPermissionActionsResponse>;
  getPermissionAction(req: GetPermissionActionRequest, md?: Metadata): Observable<PermissionActionDto>;
  createPermissionAction(req: CreatePermissionActionRequest, md?: Metadata): Observable<PermissionActionDto>;
  updatePermissionAction(req: UpdatePermissionActionRequest, md?: Metadata): Observable<PermissionActionDto>;
  deletePermissionAction(req: DeletePermissionActionRequest, md?: Metadata): Observable<EmptyResponse>;
}

// ─── Organizations ──────────────────────────────────────────────────────────
export interface OrganizationNodeDto {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  parentName?: string;
  managerId?: string;
  managerName?: string;
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
  managerId?: string;
}

export interface GetNodeRequest { id: string; }
export interface DeleteNodeRequest { id: string; }

export interface GetTreeRequest { rootId?: string; }
export interface OrganizationTreeResponse { nodes: OrganizationNodeDto[]; }

export interface ListNodesRequest { pagination?: PageRequest; }
export interface ListNodesResponse {
  items: OrganizationNodeDto[];
  page: PageMetadata;
}

export interface UpdateNodeRequest {
  id: string;
  name?: string;
  managerId?: string;
  clearManager?: boolean;
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
  listNodes(req: ListNodesRequest, md?: Metadata): Observable<ListNodesResponse>;
  updateNode(req: UpdateNodeRequest, md?: Metadata): Observable<OrganizationNodeDto>;
  moveNode(req: MoveNodeRequest, md?: Metadata): Observable<OrganizationNodeDto>;
  deleteNode(req: DeleteNodeRequest, md?: Metadata): Observable<EmptyResponse>;
  listUsersByOrg(req: ListUsersByOrgRequest, md?: Metadata): Observable<ListUsersResponse>;
}
