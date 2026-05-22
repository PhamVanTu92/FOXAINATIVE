import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateModuleGroupDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'Code phải UPPER_SNAKE_CASE' }) @MaxLength(64) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @Type(() => Number) @IsInt() @Min(0) sortOrder!: number;
}

export class UpdateModuleGroupDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class ListModuleGroupsQueryDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean() activeOnly?: boolean;
}
