import { Type } from 'class-transformer';
import {
  IsArray,
  IsBooleanString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) fullName!: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) roleCodes?: string[];
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
