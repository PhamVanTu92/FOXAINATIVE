import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { HealthModule } from './health/health.module';
import { AuthModule } from './system/auth/auth.module';
import { UsersModule } from './system/users/users.module';
import { RolesModule } from './system/roles/roles.module';
import { ModuleGroupsModule } from './system/module-groups/module-groups.module';
import { ModulesModule } from './system/modules/modules.module';
import { PermissionActionsModule } from './system/permission-actions/permission-actions.module';
import { OrganizationsModule } from './system/organizations/organizations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Đọc theo thứ tự ưu tiên (file đầu tiên thắng):
      // 1. apps/api-gateway/.env     - override per-service (gitignored)
      // 2. <repo-root>/.env          - shared cho cả monorepo
      // 3. <repo-root>/.env.local    - dev overrides (gitignored)
      // Path resolution: __dirname = .../apps/api-gateway/dist
      //   dist → api-gateway → apps → <repo-root>  = 3 levels up
      envFilePath: [
        join(process.cwd(), '.env'),
        join(__dirname, '..', '..', '..', '.env'),
        join(__dirname, '..', '..', '..', '.env.local'),
      ],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),

    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ModuleGroupsModule,
    ModulesModule,
    PermissionActionsModule,
    OrganizationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
