import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBooleanString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9._-]*$/, {
    message: 'Tên đăng nhập phải bắt đầu bằng chữ thường, chỉ chứa chữ thường/số/./_/-.',
  })
  @MaxLength(64)
  username!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) fullName!: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) roleCodes?: string[];
}

export class UserPermissionPairDto {
  @IsUUID() moduleId!: string;
  @IsUUID() actionId!: string;
}

export class SetUserPermissionsDto {
  // Tập (module_id, action_id) user muốn ACTIVE sau khi sửa grid.
  // Server tự diff vs role grants để tính GRANT/DENY overrides.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionPairDto)
  effectiveGrants!: UserPermissionPairDto[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) avatarUrl?: string;
  @IsOptional() @IsUUID() organizationId?: string;
}

export class ChangePasswordDto {
  @IsString() @IsNotEmpty() oldPassword!: string;
  @IsString() @MinLength(8) @MaxLength(200) newPassword!: string;
}

export class ChangeStatusDto {
  @IsString() @IsIn(['ACTIVE', 'INACTIVE', 'LOCKED']) status!: string;
}

export class AssignRoleDto {
  @IsString() @IsNotEmpty() @MaxLength(64) roleCode!: string;
}

export class ListUsersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsString() @IsIn(['asc', 'desc']) sortOrder?: string;
  @IsOptional() @IsString() @IsIn(['ACTIVE', 'INACTIVE', 'LOCKED']) status?: string;
  @IsOptional() @IsUUID() organizationId?: string;
}
