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
import { buildForwardMetadata } from '../../common/grpc/grpc-metadata.helper';
import {
  CreateRoleDto,
  ListRolesQueryDto,
  PermissionCodesDto,
  UpdateRoleDto,
} from './dto/roles.dto';
import { RolesService } from './roles.service';

@Controller('api/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Post()
  create(
    @Body() dto: CreateRoleDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.roles.create(dto, buildForwardMetadata(token, user));
  }

  @Get()
  list(
    @Query() q: ListRolesQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.roles.list(
      {
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          search: q.search,
          sortBy: q.sortBy,
          sortOrder: q.sortOrder,
        },
        includePermissions: q.includePermissions,
      },
      buildForwardMetadata(token, user),
    );
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.roles.get({ id }, buildForwardMetadata(token, user));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.roles.update({ id, ...dto }, buildForwardMetadata(token, user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.roles.remove({ id }, buildForwardMetadata(token, user));
  }

  @Post(':id/permissions')
  assignPermissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PermissionCodesDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.roles.assignPermissions(
      { roleId: id, permissionCodes: dto.permissionCodes },
      buildForwardMetadata(token, user),
    );
  }

  @Delete(':id/permissions')
  revokePermissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PermissionCodesDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.roles.revokePermissions(
      { roleId: id, permissionCodes: dto.permissionCodes },
      buildForwardMetadata(token, user),
    );
  }
}
