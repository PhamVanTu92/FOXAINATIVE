import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateDocumentFieldDto, CreateDocumentSchemaDto, CreateDocumentTableColumnDto,
  CreateDocumentTableDto, ListSchemasQueryDto, UpdateDocumentFieldDto,
  UpdateDocumentSchemaDto, UpdateDocumentTableColumnDto, UpdateDocumentTableDto,
} from './dto/schema.dto';
import { SchemaService } from './schema.service';

@ApiTags('Schemas')
@Controller('schemas')
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) {}

  @Get('stats') @ApiOperation({ summary: 'KPI tổng quan schema' })
  stats() { return this.schemaService.stats(); }

  @Get() @ApiOperation({ summary: 'Danh sách schema (filter search/type/isActive)' })
  findAll(@Query() query: ListSchemasQueryDto) { return this.schemaService.findAll(query); }

  @Get('code/:code') @ApiOperation({ summary: 'Chi tiết schema theo mã code' })
  findByCode(@Param('code') code: string) { return this.schemaService.findByCode(code); }

  @Get(':id') @ApiOperation({ summary: 'Chi tiết schema theo id' })
  findOne(@Param('id') id: string) { return this.schemaService.findOne(id); }

  @Post() @ApiOperation({ summary: 'Tạo schema mới' })
  create(@Body() dto: CreateDocumentSchemaDto) { return this.schemaService.create(dto); }

  @Patch(':id') @ApiOperation({ summary: 'Cập nhật schema' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentSchemaDto) { return this.schemaService.update(id, dto); }

  @Delete(':id') @ApiOperation({ summary: 'Xóa schema' })
  remove(@Param('id') id: string) { return this.schemaService.remove(id); }

  @Post(':id/fields') addField(@Param('id') schemaId: string, @Body() dto: CreateDocumentFieldDto) { return this.schemaService.addField(schemaId, dto); }
  @Patch(':id/fields/:fieldId') updateField(@Param('id') schemaId: string, @Param('fieldId') fieldId: string, @Body() dto: UpdateDocumentFieldDto) { return this.schemaService.updateField(schemaId, fieldId, dto); }
  @Delete(':id/fields/:fieldId') removeField(@Param('id') schemaId: string, @Param('fieldId') fieldId: string) { return this.schemaService.removeField(schemaId, fieldId); }

  @Post(':id/tables') addTable(@Param('id') schemaId: string, @Body() dto: CreateDocumentTableDto) { return this.schemaService.addTable(schemaId, dto); }
  @Patch(':id/tables/:tableId') updateTable(@Param('id') schemaId: string, @Param('tableId') tableId: string, @Body() dto: UpdateDocumentTableDto) { return this.schemaService.updateTable(schemaId, tableId, dto); }
  @Delete(':id/tables/:tableId') removeTable(@Param('id') schemaId: string, @Param('tableId') tableId: string) { return this.schemaService.removeTable(schemaId, tableId); }

  @Post(':id/tables/:tableId/columns') addColumn(@Param('id') schemaId: string, @Param('tableId') tableId: string, @Body() dto: CreateDocumentTableColumnDto) { return this.schemaService.addColumn(schemaId, tableId, dto); }
  @Patch(':id/tables/:tableId/columns/:columnId') updateColumn(@Param('id') schemaId: string, @Param('tableId') tableId: string, @Param('columnId') columnId: string, @Body() dto: UpdateDocumentTableColumnDto) { return this.schemaService.updateColumn(schemaId, tableId, columnId, dto); }
  @Delete(':id/tables/:tableId/columns/:columnId') removeColumn(@Param('id') schemaId: string, @Param('tableId') tableId: string, @Param('columnId') columnId: string) { return this.schemaService.removeColumn(schemaId, tableId, columnId); }
}
