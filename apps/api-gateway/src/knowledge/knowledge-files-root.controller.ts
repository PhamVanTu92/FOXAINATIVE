import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessToken, CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../common/auth/jwt-auth.guard';
import { RequirePermission } from '../common/auth/require-permission.decorator';
import { buildForwardMetadata } from '../common/grpc/grpc-metadata.helper';
import { AddKnowledgeFileDto } from './dto/knowledge.dto';
import { detectFileType, multerOptions, toPublicUrl } from './knowledge-file.helpers';
import { KnowledgeService } from './knowledge.service';

/**
 * Upload tệp tri thức không bắt buộc gắn vào bộ tri thức.
 * `knowledgeBaseId` là tùy chọn trong body — bỏ trống để tạo tệp chưa phân loại (kbId = null).
 */
@Controller('api/knowledge-files')
export class KnowledgeFilesRootController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @RequirePermission('KNOWLEDGE_UPLOAD', 'CREATE')
  async add(
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
        knowledgeBaseId: dto.knowledgeBaseId ?? '',
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
}
