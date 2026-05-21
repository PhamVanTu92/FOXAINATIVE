export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  organizationId?: string;
}

export interface RoleDto {
  id: string;
  code: string;
  name: string;
  permissions: string[];
}

export interface OrganizationNodeDto {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  children?: OrganizationNodeDto[];
}
