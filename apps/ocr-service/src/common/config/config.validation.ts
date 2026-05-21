import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  OCR_DATABASE_URL!: string;

  @IsString()
  REDIS_HOST!: string;

  @IsInt()
  REDIS_PORT!: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsOptional()
  @IsString()
  BULLMQ_PREFIX?: string;

  @IsOptional()
  @IsString()
  OCR_PROVIDER?: string;

  @IsOptional()
  @IsString()
  OCR_API_KEY?: string;

  @IsEnum(['development', 'production', 'test'])
  NODE_ENV!: 'development' | 'production' | 'test';

  @IsOptional()
  @IsInt()
  OCR_SERVICE_PORT?: number;
}

export function configValidationSchema(config: Record<string, unknown>) {
  const finalConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(finalConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Lỗi cấu hình biến môi trường:\n${errors
        .map((e) => `- ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return finalConfig;
}
