import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra trạng thái OCR Service' })
  async check() {
    let dbStatus: 'ok' | 'error' = 'ok';
    let dbError: string | undefined;

    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch (err) {
      dbStatus = 'error';
      dbError = err instanceof Error ? err.message : String(err);
    }

    return {
      service: 'ocr-service',
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: { status: dbStatus, error: dbError },
      },
    };
  }
}
