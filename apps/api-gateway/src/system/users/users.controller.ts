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
  Put,
  Query,
} from '@nestjs/common';
import { AccessToken, CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../../common/auth/jwt-auth.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { buildForwardMetadata } from '../../common/grpc/grpc-metadata.helper';
import { UsersService } from './users.service';
import {
  AssignRoleDto,
  ChangePasswordDto,
  ChangeStatusDto,
  CreateUserDto,
  ListUsersQueryDto,
  SetUserPermissionsDto,
  UpdateUserDto,
} from './dto/users.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @RequirePermission('USER_CONFIG', 'CREATE')
  create(
    @Body() dto: CreateUserDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.create(dto, buildForwardMetadata(token, user));
  }

  @Get()
  @RequirePermission('USER_CONFIG', 'READ')
  list(
    @Query() q: ListUsersQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.list(
      {
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          search: q.search,
          sortBy: q.sortBy,
          sortOrder: q.sortOrder,
        },
        status: q.status,
        organizationId: q.organizationId,
      },
      buildForwardMetadata(token, user),
    );
  }

  @Get(':id')
  @RequirePermission('USER_CONFIG', 'READ')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.get({ id }, buildForwardMetadata(token, user));
  }

  @Patch(':id')
  @RequirePermission('USER_CONFIG', 'UPDATE')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.update({ id, ...dto }, buildForwardMetadata(token, user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('USER_CONFIG', 'DELETE')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.users.remove({ id }, buildForwardMetadata(token, user));
  }

  @Post(':id/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('USER_CONFIG', 'UPDATE')
  async changePassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangePasswordDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.users.changePassword(
      { userId: id, oldPassword: dto.oldPassword, newPassword: dto.newPassword },
      buildForwardMetadata(token, user),
    );
  }

  @Post(':id/change-status')
  @RequirePermission('USER_CONFIG', 'UPDATE')
  changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeStatusDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.changeStatus(
      { userId: id, status: dto.status },
      buildForwardMetadata(token, user),
    );
  }

  @Post(':id/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('USER_CONFIG', 'UPDATE')
  async assignRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignRoleDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.users.assignRole(
      { userId: id, roleCode: dto.roleCode },
      buildForwardMetadata(token, user),
    );
  }

  @Delete(':id/roles/:roleCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('USER_CONFIG', 'UPDATE')
  async unassignRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('roleCode') roleCode: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.users.unassignRole(
      { userId: id, roleCode },
      buildForwardMetadata(token, user),
    );
  }

  @Get(':id/permissions')
  @RequirePermission('USER_CONFIG', 'READ')
  getPermissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.getPermissions({ userId: id }, buildForwardMetadata(token, user));
  }

  @Put(':id/permissions')
  @RequirePermission('USER_CONFIG', 'UPDATE')
  setPermissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetUserPermissionsDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.setPermissions(
      { userId: id, effectiveGrants: dto.effectiveGrants },
      buildForwardMetadata(token, user),
    );
  }
}
