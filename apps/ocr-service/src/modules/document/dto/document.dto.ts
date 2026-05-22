import {
  IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentStatus, DocumentType } from '@foxai/ocr-db';
import { PaginationDto } from '@foxai/shared-types';

export class UploadDocumentDto {
  @IsString() schemaId!: string;
  @IsOptional() @IsEnum(['vi', 'en', 'vi+en']) language?: 'vi' | 'en' | 'vi+en' = 'vi';
}

export class UpdateDocumentValueDto {
  @IsString() fieldId!: string;
  @IsOptional() @IsString() stringValue?: string;
}

export class UpdateDocumentLineItemDto {
  @IsOptional() @IsString() id?: string;
  @IsNumber() stt!: number;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsNumber() amount?: number;
}

export class UpdateDocumentDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UpdateDocumentValueDto)
  values?: UpdateDocumentValueDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UpdateDocumentLineItemDto)
  lineItems?: UpdateDocumentLineItemDto[];
}

export class ConfirmDocumentDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class FilterDocumentDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsArray() @IsEnum(DocumentStatus, { each: true }) status?: DocumentStatus[];
  @IsOptional() @IsString() schemaCode?: string;
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional() @IsString() sellerTaxCode?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

export class BulkActionDto {
  @IsArray() @IsString({ each: true }) documentIds!: string[];
}
