import * as http from 'http';
import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@Injectable()
export class OcrProxyService {
  constructor(private readonly config: ConfigService) {}

  private get ocrBaseUrl(): string {
    return this.config.get<string>('OCR_SERVICE_URL', 'http://192.168.100.55');
  }

  proxy(req: Request, res: Response, upstreamPath: string): void {
    const base = this.ocrBaseUrl.replace(/\/$/, '');
    const target = new URL(`${base}${upstreamPath}`);
    const transport = target.protocol === 'https:' ? https : http;

    const contentType = (req.headers['content-type'] ?? '').toLowerCase();
    const isMultipart = contentType.startsWith('multipart/form-data');

    const fwdHeaders: http.OutgoingHttpHeaders = { ...req.headers };
    fwdHeaders['host'] = target.host;
    // Remove accept-encoding so the OCR service replies with plain bytes we can pipe as-is.
    delete fwdHeaders['accept-encoding'];

    // Express json() middleware parses JSON bodies and consumes the stream.
    // For non-multipart requests with a parsed body, we re-serialise it.
    let bodyBuffer: Buffer | null = null;
    const method = req.method.toUpperCase();
    if (!isMultipart && method !== 'GET' && method !== 'HEAD') {
      const body = req.body as unknown;
      const hasBody = body !== null && body !== undefined &&
        !(typeof body === 'object' && Object.keys(body as object).length === 0);
      if (hasBody) {
        const bodyStr = JSON.stringify(body);
        bodyBuffer = Buffer.from(bodyStr, 'utf-8');
        fwdHeaders['content-type'] = 'application/json';
        fwdHeaders['content-length'] = bodyBuffer.length;
      } else {
        delete fwdHeaders['content-length'];
      }
    }

    const options: http.RequestOptions = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers: fwdHeaders,
    };

    const proxyReq = transport.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers as http.OutgoingHttpHeaders);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'OCR service unavailable', error: err.message }));
      }
    });

    if (bodyBuffer) {
      proxyReq.write(bodyBuffer);
      proxyReq.end();
    } else {
      req.pipe(proxyReq, { end: true });
    }
  }
}
