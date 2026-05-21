import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoleDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'Code phải UPPER_SNAKE_CASE' }) @MaxLength(64) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissionCodes?: string[];
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class ListRolesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsString() sortOrder?: string;
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includePermissions?: boolean;
}

export class PermissionCodesDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) permissionCodes!: string[];
}
