import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

export interface AuthenticatedRequestUser {
  sub: string;
  email: string;
  name?: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
  jti?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const auth: string | undefined = req.headers['authorization'];
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = auth.slice(7).trim();
    const secret = this.cfg.get<string>('JWT_SECRET');
    if (!secret) {
      this.logger.error('JWT_SECRET not configured in API Gateway');
      throw new UnauthorizedException('Server misconfiguration');
    }

    try {
      const payload = this.jwt.verify<any>(token, {
        secret,
        algorithms: ['HS256'],
        issuer: this.cfg.get<string>('JWT_ISSUER') ?? 'foxai-system-service',
        audience: this.cfg.get<string>('JWT_AUDIENCE') ?? 'foxai-platform',
      });

      const user: AuthenticatedRequestUser = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        roles: arrayClaim(payload.roles),
        permissions: arrayClaim(payload.permissions),
        organizationId: payload.organizationId,
        jti: payload.jti,
        iss: payload.iss,
        aud: payload.aud,
        exp: payload.exp,
        iat: payload.iat,
      };

      req.user = user;
      req.accessToken = token;
      return true;
    } catch (err: any) {
      this.logger.warn(`JWT verify failed: ${err?.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

function arrayClaim(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return [];
}
