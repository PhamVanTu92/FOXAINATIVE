import { Module } from '@nestjs/common';
import { ChatbotProxyController } from './chatbot-proxy.controller';
import { ChatbotProxyService } from './chatbot-proxy.service';

/**
 * Pure HTTP-proxy module wiring `/api/chatbot/*` to the Python
 * chatbot-service (FastAPI) running at `CHATBOT_SERVICE_URL`.
 *
 * Auth strategy: most routes inherit the global JwtAuthGuard. The widget-
 * facing routes (`/dist/sdk.js`, `/v1/public/*`, `/v1/agents/public/*`,
 * `/v1/tts/synthesize`) are marked `@Public()` so the embed widget on
 * third-party sites can call them without a user JWT.
 */
@Module({
  controllers: [ChatbotProxyController],
  providers: [ChatbotProxyService],
})
export class ChatbotProxyModule {}
