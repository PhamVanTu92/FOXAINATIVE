import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // TODO: KnowledgeModule, ChatModule, EmbeddingModule
  ],
})
export class AppModule {}
