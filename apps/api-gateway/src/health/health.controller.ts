import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/auth/public.decorator';

@Controller()
export class HealthController {
  constructor(private readonly cfg: ConfigService) {}

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'foxai-api-gateway',
      uptimeSec: Math.round(process.uptime()),
      systemServiceGrpc: this.cfg.get<string>('SYSTEM_SERVICE_GRPC_URL') ?? 'localhost:51051',
    };
  }

  @Public()
  @Get()
  root() {
    return {
      service: 'foxai-api-gateway',
      version: '0.1.0',
      docs: '/api/auth/login, /api/users, /api/roles, /api/permissions, /api/organizations',
    };
  }
}
