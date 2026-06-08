import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateModuleDto {
  @IsUUID() groupId!: string;
  @IsString() @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'Code phải UPPER_SNAKE_CASE' }) @MaxLength(100) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @Type(() => Number) @IsInt() @Min(0) sortOrder!: number;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) actionIds?: string[];
}

export class UpdateModuleDto {
  @IsOptional() @IsUUID() groupId?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() updateActions?: boolean;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) actionIds?: string[];
}

export class ListModulesQueryDto {
  @IsOptional() @IsUUID() groupId?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() activeOnly?: boolean;
}
