import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// ─── Shared ──────────────────────────────────────────────────────────────────

export class DepartmentRefDto {
  @IsUUID() departmentId!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) departmentName!: string;
}

// ─── Knowledge Base DTOs ─────────────────────────────────────────────────────

export class ListKnowledgeBasesQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class CreateKnowledgeBaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9\-_]+$/, { message: 'Mã chỉ gồm chữ hoa, số và dấu gạch' })
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;

  @IsOptional() @IsString() @MaxLength(1000) description?: string;

  @IsUUID() managingDepartmentId!: string;

  @IsString() @IsNotEmpty() @MaxLength(200) managingDepartmentName!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentRefDto)
  permittedDepartments?: DepartmentRefDto[];
}

export class UpdateKnowledgeBaseDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;

  @IsOptional() @IsString() @MaxLength(1000) description?: string;

  @IsUUID() managingDepartmentId!: string;

  @IsString() @IsNotEmpty() @MaxLength(200) managingDepartmentName!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentRefDto)
  permittedDepartments?: DepartmentRefDto[];
}

// ─── Knowledge File DTOs ──────────────────────────────────────────────────────

const FILE_TYPES = ['Word', 'Excel', 'PDF', 'Image', 'PowerPoint', 'Text'] as const;

export class ListKnowledgeFilesQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsIn(FILE_TYPES) fileType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

export class MoveKnowledgeFileDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) fileName?: string;
  @IsOptional() @IsUUID() targetKnowledgeBaseId?: string;
}

export class ListAllKnowledgeFilesQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsIn(FILE_TYPES) fileType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

export class AddKnowledgeFileDto {
  @IsOptional() @IsUUID() knowledgeBaseId?: string;

  @IsOptional() @IsString() @MaxLength(500) fileName?: string;

  @IsOptional() @IsString() @IsIn(FILE_TYPES) fileType?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return []; }
    }
    return value ?? [];
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentRefDto)
  permittedDepartments?: DepartmentRefDto[];
}

export class UpdateKnowledgeFileDto {
  @IsString() @IsNotEmpty() @MaxLength(500) fileName!: string;

  @IsString() @IsIn(FILE_TYPES) fileType!: string;

  @IsOptional() @IsNumber() @Min(0) fileSizeMb?: number;
}

export class UpdateFilePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentRefDto)
  permittedDepartments!: DepartmentRefDto[];
}

// ─── Knowledge Document DTOs ──────────────────────────────────────────────────

const DOC_STATUSES = ['Draft', 'Review', 'Approved', 'Archived'] as const;

export class ListDocumentsQueryDto {
  @IsOptional() @IsUUID() knowledgeBaseId?: string;
  @IsOptional() @IsIn(DOC_STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class UploadDocumentDto {
  @IsOptional() @IsUUID() knowledgeBaseId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    // Xử lý mọi dạng gửi từ multipart form:
    // 1. Đã là array (multer repeated fields): ["uuid1", "uuid2"]
    // 2. JSON string thường: '["uuid1","uuid2"]'
    // 3. Double-encoded JSON (curl với outer quotes): '"[\"uuid1\",\"uuid2\"]"' -> parse 2 lần
    // 4. Single string UUID
    let v: unknown = value;
    if (typeof v === 'string') {
      try { v = JSON.parse(v); } catch { /* không phải JSON */ }
    }
    // Handle double-encoded: lần parse đầu vẫn trả về string
    if (typeof v === 'string') {
      try { v = JSON.parse(v); } catch { /* không phải JSON */ }
    }
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (v) return [String(v)];
    return [];
  })
  @IsArray()
  @IsUUID('4', { each: true })
  knowledgeBaseIds?: string[];

  @IsString() @IsNotEmpty() @MaxLength(500) title!: string;

  @IsOptional() @IsString() @IsIn(FILE_TYPES) fileType?: string;

  @IsOptional() @IsString() contentSummary?: string;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CreateDocumentVersionDto {
  @IsString() @IsNotEmpty() @MaxLength(500) changeNote!: string;

  @IsOptional() @IsString() contentSummary?: string;
}

export class RequestRevisionDto {
  @IsString() @IsNotEmpty() @MaxLength(500) revisionNote!: string;
}
