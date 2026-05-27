import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/auth/public.decorator';
import { ChatbotProxyService } from './chatbot-proxy.service';

/**
 * Strip the `/api/chatbot` prefix so the upstream chatbot-service receives
 * its native path (e.g. `/api/chatbot/v1/chatbots` → `/v1/chatbots`).
 */
function upstreamPath(req: Request): string {
  return req.originalUrl.replace(/^\/api\/chatbot/, '') || '/';
}

@Controller('api/chatbot')
export class ChatbotProxyController {
  constructor(private readonly proxy: ChatbotProxyService) {}

  // ── Public widget-facing endpoints ─────────────────────────────────────
  // Embedded widgets on third-party sites don't carry a user JWT — they
  // identify themselves by the rotatable `public_id` token instead. These
  // routes are @Public() to skip the global JwtAuthGuard.
  //
  // IMPORTANT: each route uses `@All()` (not `@Get/@Post`) so that ANY
  // HTTP method (including a browser address-bar GET) is matched and
  // routed to the upstream — upstream then decides method-validity.
  // Without this, a stray GET on a POST-only public route would tumble
  // into the @All('*') wildcard at the bottom and get blocked by the
  // global JwtAuthGuard (→ confusing "Missing Bearer token" 401).

  /** Static SDK bundle that the embed snippet downloads. */
  @Public()
  @All('dist/sdk.js')
  serveSdkJs(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  /** ESM bundle variant. */
  @Public()
  @All('dist/sdk.esm.js')
  serveSdkEsm(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  /** Widget static assets (CSS, fonts, etc.). */
  @Public()
  @All('widget/*')
  serveWidget(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  /** Public chatbot config — used by the widget to render itself. */
  @Public()
  @All('v1/public/chatbots/*')
  getPublicChatbot(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  /** Public chat endpoints (non-stream + SSE). Auth: client_id + optional public_id. */
  @Public()
  @All('v1/agents/public/chat/public')
  publicChat(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  @Public()
  @All('v1/agents/public/chat/public/stream')
  publicChatStream(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  /** Public TTS — quota-gated server-side by the optional public_id field. */
  @Public()
  @All('v1/tts/synthesize')
  ttsSynthesize(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  // Swagger UI + OpenAPI spec passthrough — dev convenience so the team
  // can browse the chatbot-service API surface without needing a JWT.
  @Public()
  @All('docs')
  swaggerUi(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  @Public()
  @All('openapi.json')
  openapiSpec(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  @Public()
  @All('redoc')
  redocUi(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  // ── Authenticated endpoints ────────────────────────────────────────────
  // Everything else (CRUD chatbots, conversation history, dashboard, file
  // upload, agent stream w/ JWT) falls through to this wildcard and is
  // gated by the global JwtAuthGuard.

  @All('*')
  proxyAll(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }
}
