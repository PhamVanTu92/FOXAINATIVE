import {
  IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString,
  MaxLength, Min, ValidateNested, Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DocumentType, FieldDataType, FieldPosition } from '@foxai/ocr-db';

export class CreateDocumentFieldDto {
  @IsString() @MaxLength(100)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, { message: 'fieldKey chỉ chứa chữ cái, số và dấu gạch dưới' })
  fieldKey!: string;

  @IsString() @MaxLength(255) label!: string;
  @IsEnum(FieldDataType) dataType!: FieldDataType;
  @IsEnum(FieldPosition) position!: FieldPosition;
  @IsOptional() @IsBoolean() isRequired?: boolean = false;
  @IsOptional() @IsBoolean() isUnique?: boolean = false;
  @IsOptional() @IsString() validationRegex?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number = 0;
}

export class CreateDocumentTableColumnDto {
  @IsString() @MaxLength(100) columnKey!: string;
  @IsString() @MaxLength(255) label!: string;
  @IsEnum(FieldDataType) dataType!: FieldDataType;
  @IsOptional() @IsBoolean() isRequired?: boolean = false;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number = 0;
}

export class CreateDocumentTableDto {
  @IsString() @MaxLength(100) tableKey!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateDocumentTableColumnDto)
  columns!: CreateDocumentTableColumnDto[];
}

export class CreateDocumentSchemaDto {
  @IsString() @MaxLength(50)
  @Matches(/^[A-Z0-9_\-]+$/, { message: 'Mã chứng từ chỉ chứa chữ hoa, số, _, -' })
  code!: string;

  @IsString() @MaxLength(255) name!: string;
  @IsEnum(DocumentType) type!: DocumentType;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateDocumentFieldDto)
  fields!: CreateDocumentFieldDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateDocumentTableDto)
  tables?: CreateDocumentTableDto[];
}

export class UpdateDocumentSchemaDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateDocumentFieldDto {
  @IsOptional() @IsString() @MaxLength(100) fieldKey?: string;
  @IsOptional() @IsString() @MaxLength(255) label?: string;
  @IsOptional() @IsEnum(FieldDataType) dataType?: FieldDataType;
  @IsOptional() @IsEnum(FieldPosition) position?: FieldPosition;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsBoolean() isUnique?: boolean;
  @IsOptional() @IsString() validationRegex?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpdateDocumentTableDto {
  @IsOptional() @IsString() @MaxLength(100) tableKey?: string;
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpdateDocumentTableColumnDto {
  @IsOptional() @IsString() @MaxLength(100) columnKey?: string;
  @IsOptional() @IsString() @MaxLength(255) label?: string;
  @IsOptional() @IsEnum(FieldDataType) dataType?: FieldDataType;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class ListSchemasQueryDto {
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean() isActive?: boolean;
}
