import { Module } from '@nestjs/common';
import { KnowledgeGrpcModule } from '../grpc/knowledge-grpc.module';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeFilesController } from './knowledge-files.controller';
import { KnowledgeFilesRootController } from './knowledge-files-root.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [KnowledgeGrpcModule],
  controllers: [
    KnowledgeBasesController,
    KnowledgeFilesController,
    KnowledgeFilesRootController,
    KnowledgeDocumentsController,
  ],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
