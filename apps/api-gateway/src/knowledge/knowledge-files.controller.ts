import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AccessToken, CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../common/auth/jwt-auth.guard';
import { RequirePermission } from '../common/auth/require-permission.decorator';
import { buildForwardMetadata } from '../common/grpc/grpc-metadata.helper';
import {
  AddKnowledgeFileDto,
  ListKnowledgeFilesQueryDto,
  UpdateFilePermissionsDto,
  UpdateKnowledgeFileDto,
} from './dto/knowledge.dto';
import { KnowledgeService } from './knowledge.service';

const FILE_TYPE_MAP: Record<string, string> = {
  '.pdf': 'PDF',
  '.doc': 'Word',
  '.docx': 'Word',
  '.xls': 'Excel',
  '.xlsx': 'Excel',
  '.ppt': 'PowerPoint',
  '.pptx': 'PowerPoint',
  '.txt': 'Text',
  '.jpg': 'Image',
  '.jpeg': 'Image',
  '.png': 'Image',
  '.gif': 'Image',
  '.webp': 'Image',
};

function detectFileType(filename: string): string {
  return FILE_TYPE_MAP[extname(filename).toLowerCase()] ?? 'PDF';
}

function toPublicUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const base = (process.env['PUBLIC_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try { return `${base}${new URL(path).pathname}`; } catch { return path; }
  }
  return `${base}/${path}`;
}

const multerOptions = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'knowledge-files'),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
};

@Controller('api/knowledge-bases/:kbId/files')
export class KnowledgeFilesController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  @RequirePermission('KNOWLEDGE_UPLOAD', 'READ')
  async list(
    @Param('kbId', new ParseUUIDPipe()) kbId: string,
    @Query() q: ListKnowledgeFilesQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const result = await this.knowledge.listKnowledgeFiles(
      {
        knowledgeBaseId: kbId,
        search: q.search,
        fileType: q.fileType,
        page: q.page ?? 1,
        pageSize: q.pageSize ?? 50,
      },
      buildForwardMetadata(token, user),
    );
    const r = result as any;
    return {
      ...r,
      items: (r.items ?? []).map((item: any) => ({ ...item, storagePath: toPublicUrl(item.storagePath) })),
    };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @RequirePermission('KNOWLEDGE_UPLOAD', 'CREATE')
  async add(
    @Param('kbId', new ParseUUIDPipe()) kbId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: AddKnowledgeFileDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const fileName = dto.fileName ?? file?.originalname ?? 'untitled';
    const fileType = dto.fileType ?? (file ? detectFileType(file.originalname) : 'PDF');
    const fileSizeMb = file ? +(file.size / (1024 * 1024)).toFixed(4) : 0;
    const storagePath = file ? `uploads/knowledge-files/${file.filename}` : undefined;

    const result = await this.knowledge.addKnowledgeFile(
      {
        knowledgeBaseId: kbId,
        fileName,
        fileType,
        fileSizeMb,
        permittedDepartments: dto.permittedDepartments ?? [],
        uploadedBy: user.sub,
        storagePath,
      },
      buildForwardMetadata(token, user),
    );
    return { ...(result as any), storagePath: toPublicUrl((result as any).storagePath) };
  }

  @Get(':fileId')
  @RequirePermission('KNOWLEDGE_UPLOAD', 'READ')
  async getOne(
    @Param('kbId', new ParseUUIDPipe()) kbId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const result = await this.knowledge.getKnowledgeFile(
      { id: fileId, knowledgeBaseId: kbId },
      buildForwardMetadata(token, user),
    );
    return { ...(result as any), storagePath: toPublicUrl((result as any).storagePath) };
  }

  @Get(':fileId/file')
  @RequirePermission('KNOWLEDGE_MGMT', 'READ')
  async downloadFile(
    @Param('kbId', new ParseUUIDPipe()) kbId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res() res: Response,
  ) {
    const fileInfo = await this.knowledge.listKnowledgeFiles(
      { knowledgeBaseId: kbId, page: 1, pageSize: 1000 },
      buildForwardMetadata(token, user),
    );
    const found = (fileInfo as any).items?.find((f: any) => f.id === fileId);
    const rawPath: string = found?.storagePath ?? '';
    if (!rawPath) throw new NotFoundException('File chưa có đường dẫn lưu trữ');
    (res as any).redirect(toPublicUrl(rawPath)!);
  }

  @Put(':fileId')
  @RequirePermission('KNOWLEDGE_UPLOAD', 'UPDATE')
  update(
    @Param('kbId', new ParseUUIDPipe()) kbId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Body() dto: UpdateKnowledgeFileDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.updateKnowledgeFile(
      {
        id: fileId,
        knowledgeBaseId: kbId,
        fileName: dto.fileName,
        fileType: dto.fileType,
        fileSizeMb: dto.fileSizeMb ?? 0,
      },
      buildForwardMetadata(token, user),
    );
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('KNOWLEDGE_UPLOAD', 'DELETE')
  async remove(
    @Param('kbId', new ParseUUIDPipe()) kbId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.knowledge.deleteKnowledgeFile(
      { id: fileId, knowledgeBaseId: kbId },
      buildForwardMetadata(token, user),
    );
  }

  @Put(':fileId/permissions')
  @RequirePermission('KNOWLEDGE_UPLOAD', 'UPDATE')
  updatePermissions(
    @Param('kbId', new ParseUUIDPipe()) kbId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Body() dto: UpdateFilePermissionsDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.updateFilePermissions(
      {
        id: fileId,
        knowledgeBaseId: kbId,
        permittedDepartments: dto.permittedDepartments,
      },
      buildForwardMetadata(token, user),
    );
  }
}
