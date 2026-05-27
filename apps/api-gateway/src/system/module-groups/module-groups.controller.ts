import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AccessToken, CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../../common/auth/jwt-auth.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { buildForwardMetadata } from '../../common/grpc/grpc-metadata.helper';
import {
  CreateModuleGroupDto,
  ListModuleGroupsQueryDto,
  UpdateModuleGroupDto,
} from './dto/module-groups.dto';
import { ModuleGroupsService } from './module-groups.service';

@Controller('api/module-groups')
export class ModuleGroupsController {
  constructor(private readonly svc: ModuleGroupsService) {}

  @Get()
  @RequirePermission('ROLE_CONFIG', 'READ')
  list(
    @Query() q: ListModuleGroupsQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.svc.list({ activeOnly: q.activeOnly ?? false }, buildForwardMetadata(token, user));
  }

  @Get(':id')
  @RequirePermission('ROLE_CONFIG', 'READ')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.svc.get({ id }, buildForwardMetadata(token, user));
  }

  @Post()
  @RequirePermission('ROLE_CONFIG', 'CREATE')
  create(
    @Body() dto: CreateModuleGroupDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.svc.create(dto, buildForwardMetadata(token, user));
  }

  @Patch(':id')
  @RequirePermission('ROLE_CONFIG', 'UPDATE')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModuleGroupDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.svc.update({ id, ...dto }, buildForwardMetadata(token, user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ROLE_CONFIG', 'DELETE')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.svc.remove({ id }, buildForwardMetadata(token, user));
  }
}
