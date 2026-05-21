import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // TODO: UserModule, RoleModule, OrganizationModule
  ],
})
export class AppModule {}
