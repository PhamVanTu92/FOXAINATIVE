import {
  IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested, IsNumber, IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { DocumentStatus, DocumentType } from '@foxai/ocr-db';
import { PaginationDto } from '@foxai/shared-types';

export class UploadDocumentDto {
  @IsString() schemaId!: string;
  @IsOptional() @IsEnum(['vi', 'en', 'vi+en']) language?: 'vi' | 'en' | 'vi+en' = 'vi';
  @IsOptional() @IsEnum(['gemini', 'claude', 'local-pdf', 'mock']) ocrProvider?: 'gemini' | 'claude' | 'local-pdf' | 'mock';
}

export class UpdateDocumentValueDto {
  @IsString() fieldId!: string;
  @IsOptional() @IsString() stringValue?: string;
}

export class UpdateDocumentLineItemDto {
  @IsOptional() @IsString() id?: string;
  @IsNumber() stt!: number;
  @IsOptional() @IsString() tableKey?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsObject() extraData?: Record<string, unknown>;
}

export class UpdateDocumentDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UpdateDocumentValueDto)
  values?: UpdateDocumentValueDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UpdateDocumentLineItemDto)
  lineItems?: UpdateDocumentLineItemDto[];

  /** Cho phép frontend hạ status PROCESSED → DRAFT khi người dùng "Lưu bản nháp". */
  @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

export class ConfirmDocumentDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class FilterDocumentDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  @IsArray() @IsEnum(DocumentStatus, { each: true })
  status?: DocumentStatus[];
  @IsOptional() @IsString() schemaCode?: string;
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional() @IsString() sellerTaxCode?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

export class BulkActionDto {
  @IsArray() @IsString({ each: true }) documentIds!: string[];
}
