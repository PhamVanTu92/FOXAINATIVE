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
import { UsersService } from './users.service';
import {
  AssignRoleDto,
  ChangePasswordDto,
  ChangeStatusDto,
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from './dto/users.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(
    @Body() dto: CreateUserDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.create(dto, buildForwardMetadata(token, user));
  }

  @Get()
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
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.users.get({ id }, buildForwardMetadata(token, user));
  }

  @Patch(':id')
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
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.users.remove({ id }, buildForwardMetadata(token, user));
  }

  @Post(':id/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
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
}
