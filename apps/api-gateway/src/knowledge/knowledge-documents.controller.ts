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
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const fileSizeMb = file ? +(file.size / (1024 * 1024)).toFixed(4) : 0;
    const fileType = dto.fileType ?? (file ? detectFileType(file.originalname) : 'PDF');
    const baseUrl = (process.env['PUBLIC_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
    const storagePath = file ? `${baseUrl}/uploads/knowledge-docs/${file.filename}` : undefined;

    return this.knowledge.uploadDocument(
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
  }

  @Get()
  list(
    @Query() q: ListDocumentsQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.listDocuments(
      {
        knowledgeBaseId: q.knowledgeBaseId,
        status: q.status,
        search: q.search,
        page: q.page ?? 1,
        pageSize: q.pageSize ?? 20,
      },
      buildForwardMetadata(token, user),
    );
  }

  @Get(':docId/file')
  async downloadFile(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res() res: Response,
  ) {
    const doc = await this.knowledge.getDocument({ id: docId }, buildForwardMetadata(token, user));
    const storagePath: string = (doc as any).storagePath ?? '';
    if (!storagePath) {
      throw new NotFoundException('Tài liệu chưa có file đính kèm');
    }
    // storagePath là public URL — redirect trực tiếp
    (res as any).redirect(storagePath);
  }

  @Get(':docId')
  get(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.getDocument({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/submit-review')
  @HttpCode(HttpStatus.OK)
  submitForReview(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.submitDocumentForReview({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.approveDocument({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/return-draft')
  @HttpCode(HttpStatus.OK)
  returnToDraft(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.returnDocumentToDraft({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/request-revision')
  @HttpCode(HttpStatus.OK)
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
  archive(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.archiveDocument({ id: docId }, buildForwardMetadata(token, user));
  }

  @Post(':docId/rollback')
  @HttpCode(HttpStatus.OK)
  rollback(
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.rollbackDocument({ id: docId }, buildForwardMetadata(token, user));
  }

  @Get(':docId/versions')
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
