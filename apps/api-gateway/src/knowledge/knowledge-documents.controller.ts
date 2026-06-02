import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
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
  CreateDocumentVersionDto,
  ListDocumentsQueryDto,
  RequestRevisionDto,
  UploadDocumentDto,
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
  const ext = extname(filename).toLowerCase();
  return FILE_TYPE_MAP[ext] ?? 'PDF';
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
    destination: join(process.cwd(), 'uploads', 'knowledge-docs'),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
};

@Controller('api/knowledge-documents')
export class KnowledgeDocumentsController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @RequirePermission('KNOWLEDGE_UPLOAD', 'CREATE')
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const fileSizeMb = file ? +(file.size / (1024 * 1024)).toFixed(4) : 0;
    const fileType = dto.fileType ?? (file ? detectFileType(file.originalname) : 'PDF');
    const storagePath = file ? `uploads/knowledge-docs/${file.filename}` : undefined;

    const result = await this.knowledge.uploadDocument(
      {
        knowledgeBaseId: dto.knowledgeBaseId,
        title: dto.title,
        fileType,
        fileSizeMb,
        contentSummary: dto.contentSummary,
        note: dto.note,
        uploadedBy: user.sub,
        storagePath,
      },
      buildForwardMetadata(token, user),
    );
    return { ...(result as any), storagePath: toPublicUrl((result as any).storagePath) };
  }

  @Get()
  @RequirePermission('KNOWLEDGE_MGMT', 'READ')
  async list(
    @Query() q: ListDocumentsQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const result = await this.knowledge.listDocuments(
      {
        knowledgeBaseId: q.knowledgeBaseId,
        status: q.status,
        search: q.search,
        page: q.page ?? 1,
        pageSize: q.pageSize ?? 20,
      },
      buildForwardMetadata(token, user),
    );
    const r = result as any;
    return {
      ...r,
      items: (r.items ?? []).map((item: any) => ({ ...item, storagePath: toPublicUrl(item.storagePath) })),
    };
  }

  @Get(':docId/file')
  @RequirePermission('KNOWLEDGE_MGMT', 'READ')
  async downloadFile(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res() res: Response,
  ) {
    const doc = await this.knowledge.getDocument({ id: docId }, buildForwardMetadata(token, user));
    const rawPath: string = (doc as any).storagePath ?? '';
    if (!rawPath) {
      throw new NotFoundException('Tài liệu chưa có file đính kèm');
    }
    (res as any).redirect(toPublicUrl(rawPath)!);
  }

  @Get(':docId')
  @RequirePermission('KNOWLEDGE_MGMT', 'READ')
  async get(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const doc = await this.knowledge.getDocument({ id: docId }, buildForwardMetadata(token, user));
    return { ...(doc as any), storagePath: toPublicUrl((doc as any).storagePath) };
  }

  @Post(':docId/submit-review')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('KNOWLEDGE_UPLOAD', 'UPDATE')
  submitForReview(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.submitDocumentForReview({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('KNOWLEDGE_REVIEW', 'UPDATE')
  approve(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.approveDocument({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/return-draft')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('KNOWLEDGE_REVIEW', 'UPDATE')
  returnToDraft(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.returnDocumentToDraft({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/request-revision')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('KNOWLEDGE_REVIEW', 'UPDATE')
  requestRevision(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @Body() dto: RequestRevisionDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.requestDocumentRevision(
      { id: docId, revisionNote: dto.revisionNote },
      buildForwardMetadata(token, user),
    );
  }

  @Post(':docId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('KNOWLEDGE_MGMT', 'UPDATE')
  archive(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.archiveDocument({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/rollback')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('KNOWLEDGE_MGMT', 'UPDATE')
  rollback(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.rollbackDocument({ id: docId }, buildForwardMetadata(token, user));
  }

  @Get(':docId/versions')
  @RequirePermission('KNOWLEDGE_MGMT', 'READ')
  listVersions(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.listDocumentVersions(
      { documentId: docId },
      buildForwardMetadata(token, user),
    );
  }

  @Post(':docId/versions')
  @RequirePermission('KNOWLEDGE_UPLOAD', 'CREATE')
  createVersion(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @Body() dto: CreateDocumentVersionDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.createDocumentVersion(
      {
        id: docId,
        changeNote: dto.changeNote,
        contentSummary: dto.contentSummary,
        createdBy: user.sub,
      },
      buildForwardMetadata(token, user),
    );
  }
}
