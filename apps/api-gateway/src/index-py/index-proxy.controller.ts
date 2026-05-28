import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/auth/public.decorator';
import { IndexProxyService } from './index-proxy.service';

/** Strip the `/api/index` prefix to get the upstream path. */
function upstreamPath(req: Request): string {
  return req.originalUrl.replace(/^\/api\/index/, '') || '/';
}

@Controller('api/index')
export class IndexProxyController {
  constructor(private readonly proxy: IndexProxyService) {}

  // Public file/image serving endpoints — accessed by the chat widget's
  // <img src> / <a href> which can't send Authorization headers. The
  // bucket name + path act as the capability token.
  //
  // Use @All() so a browser GET / HEAD / OPTIONS preflight all hit the
  // upstream (which then returns 405 for unsupported methods) instead of
  // tumbling into the @All('*') wildcard and getting blocked by the JWT guard.
  @Public()
  @All('v1/public/images/*')
  serveImage(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  @Public()
  @All('v1/public/files/*')
  serveFile(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  // Swagger UI + OpenAPI spec — dev convenience.
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

  // All other endpoints (collections CRUD, document upload, chunks
  // management) require a valid user JWT — the global JwtAuthGuard
  // handles that.
  @All('*')
  proxyAll(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }
}
