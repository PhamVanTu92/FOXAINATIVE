import { Module } from '@nestjs/common';
import { IndexProxyController } from './index-proxy.controller';
import { IndexProxyService } from './index-proxy.service';

/**
 * Proxy `/api/index/*` → Python index-service.
 *
 * Distinct from the .NET KnowledgeModule which proxies `/api/knowledge/*`
 * to the gRPC knowledge-service.
 */
@Module({
  controllers: [IndexProxyController],
  providers: [IndexProxyService],
})
export class IndexProxyModule {}
