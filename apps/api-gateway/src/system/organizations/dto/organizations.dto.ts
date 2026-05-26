import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateNodeDto {
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_-]*$/, { message: 'Code chỉ chứa chữ/số/_/-, bắt đầu bằng chữ' })
  @MaxLength(64)
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;

  @IsOptional() @IsUUID() parentId?: string;

  @IsOptional() @IsUUID() managerId?: string;
}

export class UpdateNodeDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;

  @IsOptional() @IsUUID() managerId?: string;

  @IsOptional() @IsBoolean() clearManager?: boolean;
}

export class MoveNodeDto {
  @IsOptional() @IsUUID() newParentId?: string;
}

export class GetTreeQueryDto {
  @IsOptional() @IsUUID() rootId?: string;
}

export class ListNodesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

export class ListUsersByOrgQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() includeSubOrgs?: boolean;
}
