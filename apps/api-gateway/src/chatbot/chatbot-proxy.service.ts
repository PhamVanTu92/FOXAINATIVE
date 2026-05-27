import * as http from 'http';
import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

/**
 * Generic HTTP-passthrough proxy to the Python chatbot-service.
 *
 * The chatbot-service exposes a FastAPI app at port 8000 inside the
 * `foxai-chatbot-service` container. This service forwards any HTTP
 * verb (incl. SSE streaming POSTs for chat) preserving headers / body /
 * query string, then pipes the response back to the original client.
 */
@Injectable()
export class ChatbotProxyService {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>(
      'CHATBOT_SERVICE_URL',
      'http://chatbot-service:8000',
    );
  }

  proxy(req: Request, res: Response, upstreamPath: string): void {
    const base = this.baseUrl.replace(/\/$/, '');
    const target = new URL(`${base}${upstreamPath}`);
    const transport = target.protocol === 'https:' ? https : http;

    const contentType = (req.headers['content-type'] ?? '').toLowerCase();
    const isMultipart = contentType.startsWith('multipart/form-data');
    // SSE chat endpoints — keep proxy unbuffered.
    const isStream = upstreamPath.includes('/stream');

    const fwdHeaders: http.OutgoingHttpHeaders = { ...req.headers };
    fwdHeaders['host'] = target.host;
    // Plain bytes back — easier to pipe.
    delete fwdHeaders['accept-encoding'];

    // Express json() middleware parses JSON bodies and consumes the stream.
    // For non-multipart requests with a parsed body, we re-serialise it.
    let bodyBuffer: Buffer | null = null;
    const method = req.method.toUpperCase();
    if (!isMultipart && method !== 'GET' && method !== 'HEAD') {
      const body = req.body as unknown;
      const hasBody =
        body !== null &&
        body !== undefined &&
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
      // SSE: tell upstream proxies (nginx etc.) not to buffer.
      if (isStream) {
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
      }
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers as http.OutgoingHttpHeaders);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message: 'Chatbot service unavailable',
            error: err.message,
          }),
        );
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
