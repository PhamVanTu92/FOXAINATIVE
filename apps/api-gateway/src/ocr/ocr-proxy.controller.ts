import { All, Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/auth/public.decorator';
import { OcrProxyService } from './ocr-proxy.service';

// Strip /api/ocr prefix to get the upstream path (with query string).
function upstreamPath(req: Request): string {
  return req.originalUrl.replace(/^\/api\/ocr/, '') || '/';
}

@Controller('api/ocr')
export class OcrProxyController {
  constructor(private readonly proxy: OcrProxyService) {}

  // SSE and file-serving endpoints are accessed directly by the browser
  // (EventSource / <img src> / <iframe src>) which cannot send Authorization headers.
  // They are marked @Public() and rely on the document UUID as a capability token.
  @Public()
  @Get('documents/:id/sse')
  streamSse(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  @Public()
  @Get('documents/:id/file')
  serveFile(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  // Public read-only endpoint — document UUID acts as capability token.
  @Public()
  @Get('documents/:id')
  getDocument(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  // Public schema structure endpoint — allows external systems to read form fields/tables.
  @Public()
  @Get('schemas/code/:code')
  getSchemaByCode(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }

  // All other OCR endpoints — JWT guard applies (set globally in AppModule).
  @All('*')
  proxyAll(@Req() req: Request, @Res() res: Response): void {
    this.proxy.proxy(req, res, upstreamPath(req));
  }
}
