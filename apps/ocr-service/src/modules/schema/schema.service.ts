import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@foxai/ocr-db';
import {
  CreateDocumentFieldDto, CreateDocumentSchemaDto, CreateDocumentTableColumnDto,
  CreateDocumentTableDto, ListSchemasQueryDto, UpdateDocumentFieldDto,
  UpdateDocumentSchemaDto, UpdateDocumentTableColumnDto, UpdateDocumentTableDto,
} from './dto/schema.dto';
import { PrismaService } from '../../common/prisma/prisma.service';

const SCHEMA_DETAIL_INCLUDE = {
  fields: { orderBy: { displayOrder: 'asc' as const } },
  tables: {
    orderBy: { displayOrder: 'asc' as const },
    include: { columns: { orderBy: { displayOrder: 'asc' as const } } },
  },
} satisfies Prisma.DocumentSchemaInclude;

@Injectable()
export class SchemaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListSchemasQueryDto = {}) {
    const where: Prisma.DocumentSchemaWhereInput = {};
    if (query.type) where.type = query.type;
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.documentSchema.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { fields: true, tables: true, documents: true } } },
    });
  }

  async stats() {
    const [total, active, fields, tables] = await Promise.all([
      this.prisma.client.documentSchema.count(),
      this.prisma.client.documentSchema.count({ where: { isActive: true } }),
      this.prisma.client.documentField.count(),
      this.prisma.client.documentTable.count(),
    ]);
    return { totalSchemas: total, activeSchemas: active, totalFields: fields, totalTables: tables };
  }

  async findOne(id: string) {
    const schema = await this.prisma.client.documentSchema.findUnique({
      where: { id },
      include: SCHEMA_DETAIL_INCLUDE,
    });
    if (!schema) throw new NotFoundException(`Không tìm thấy schema "${id}".`);
    return schema;
  }

  async findByCode(code: string) {
    const schema = await this.prisma.client.documentSchema.findUnique({
      where: { code },
      include: SCHEMA_DETAIL_INCLUDE,
    });
    if (!schema) throw new NotFoundException(`Không tìm thấy schema mã "${code}".`);
    return schema;
  }

  async create(dto: CreateDocumentSchemaDto, createdBy = 'system') {
    const existing = await this.prisma.client.documentSchema.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Mã chứng từ "${dto.code}" đã tồn tại.`);
    return this.prisma.client.documentSchema.create({
      data: {
        code: dto.code, name: dto.name, type: dto.type,
        description: dto.description, createdBy,
        fields: { create: dto.fields.map((f) => ({ ...f, isRequired: f.isRequired ?? false, isUnique: f.isUnique ?? false, displayOrder: f.displayOrder ?? 0 })) },
        tables: dto.tables ? {
          create: dto.tables.map((t) => ({
            tableKey: t.tableKey, name: t.name, description: t.description,
            columns: { create: t.columns.map((c) => ({ ...c, isRequired: c.isRequired ?? false, displayOrder: c.displayOrder ?? 0 })) },
          })),
        } : undefined,
      },
      include: SCHEMA_DETAIL_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateDocumentSchemaDto) {
    await this.findOne(id);
    try {
      return await this.prisma.client.documentSchema.update({ where: { id }, data: dto, include: SCHEMA_DETAIL_INCLUDE });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025')
        throw new NotFoundException(`Không tìm thấy schema "${id}".`);
      throw err;
    }
  }

  async remove(id: string) {
    const used = await this.prisma.client.document.count({ where: { schemaId: id } });
    if (used > 0) throw new ConflictException(`Schema đang được dùng bởi ${used} chứng từ.`);
    await this.prisma.client.documentSchema.delete({ where: { id } });
    return { deleted: true };
  }

  async addField(schemaId: string, dto: CreateDocumentFieldDto) {
    await this.findOne(schemaId);
    const dup = await this.prisma.client.documentField.findUnique({ where: { schemaId_fieldKey: { schemaId, fieldKey: dto.fieldKey } } });
    if (dup) throw new ConflictException(`Trường "${dto.fieldKey}" đã tồn tại.`);
    return this.prisma.client.documentField.create({ data: { schemaId, ...dto, isRequired: dto.isRequired ?? false, isUnique: dto.isUnique ?? false, displayOrder: dto.displayOrder ?? 0 } });
  }

  async updateField(schemaId: string, fieldId: string, dto: UpdateDocumentFieldDto) {
    await this.assertFieldBelongs(schemaId, fieldId);
    return this.prisma.client.documentField.update({ where: { id: fieldId }, data: dto });
  }

  async removeField(schemaId: string, fieldId: string) {
    await this.assertFieldBelongs(schemaId, fieldId);
    await this.prisma.client.documentField.delete({ where: { id: fieldId } });
    return { deleted: true };
  }

  async addTable(schemaId: string, dto: CreateDocumentTableDto) {
    await this.findOne(schemaId);
    const dup = await this.prisma.client.documentTable.findUnique({ where: { schemaId_tableKey: { schemaId, tableKey: dto.tableKey } } });
    if (dup) throw new ConflictException(`Bảng "${dto.tableKey}" đã tồn tại.`);
    return this.prisma.client.documentTable.create({
      data: {
        schemaId, tableKey: dto.tableKey, name: dto.name, description: dto.description,
        columns: { create: dto.columns.map((c) => ({ ...c, isRequired: c.isRequired ?? false, displayOrder: c.displayOrder ?? 0 })) },
      },
      include: { columns: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async updateTable(schemaId: string, tableId: string, dto: UpdateDocumentTableDto) {
    await this.assertTableBelongs(schemaId, tableId);
    return this.prisma.client.documentTable.update({ where: { id: tableId }, data: dto, include: { columns: { orderBy: { displayOrder: 'asc' } } } });
  }

  async removeTable(schemaId: string, tableId: string) {
    await this.assertTableBelongs(schemaId, tableId);
    await this.prisma.client.documentTable.delete({ where: { id: tableId } });
    return { deleted: true };
  }

  async addColumn(schemaId: string, tableId: string, dto: CreateDocumentTableColumnDto) {
    await this.assertTableBelongs(schemaId, tableId);
    const dup = await this.prisma.client.documentTableColumn.findUnique({ where: { tableId_columnKey: { tableId, columnKey: dto.columnKey } } });
    if (dup) throw new ConflictException(`Cột "${dto.columnKey}" đã tồn tại.`);
    return this.prisma.client.documentTableColumn.create({ data: { tableId, ...dto, isRequired: dto.isRequired ?? false, displayOrder: dto.displayOrder ?? 0 } });
  }

  async updateColumn(schemaId: string, tableId: string, columnId: string, dto: UpdateDocumentTableColumnDto) {
    await this.assertColumnBelongs(schemaId, tableId, columnId);
    return this.prisma.client.documentTableColumn.update({ where: { id: columnId }, data: dto });
  }

  async removeColumn(schemaId: string, tableId: string, columnId: string) {
    await this.assertColumnBelongs(schemaId, tableId, columnId);
    await this.prisma.client.documentTableColumn.delete({ where: { id: columnId } });
    return { deleted: true };
  }

  private async assertFieldBelongs(schemaId: string, fieldId: string) {
    const f = await this.prisma.client.documentField.findUnique({ where: { id: fieldId }, select: { schemaId: true } });
    if (!f || f.schemaId !== schemaId) throw new NotFoundException(`Trường "${fieldId}" không thuộc schema "${schemaId}".`);
  }

  private async assertTableBelongs(schemaId: string, tableId: string) {
    const t = await this.prisma.client.documentTable.findUnique({ where: { id: tableId }, select: { schemaId: true } });
    if (!t || t.schemaId !== schemaId) throw new NotFoundException(`Bảng "${tableId}" không thuộc schema "${schemaId}".`);
  }

  private async assertColumnBelongs(schemaId: string, tableId: string, columnId: string) {
    const c = await this.prisma.client.documentTableColumn.findUnique({ where: { id: columnId }, select: { tableId: true, table: { select: { schemaId: true } } } });
    if (!c || c.tableId !== tableId || c.table.schemaId !== schemaId)
      throw new NotFoundException(`Cột "${columnId}" không thuộc bảng "${tableId}".`);
  }
}
